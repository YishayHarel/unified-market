import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// CORS configuration - restrict to allowed origins
const ALLOWED_ORIGINS = [
  'https://85a34aed-b2cd-4a8b-8664-ff1b782adf81.lovableproject.com',
  'https://lovable.dev',
  'http://localhost:8080',
  'http://localhost:5173'
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o.replace(/\/$/, ''))) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Rate limiting - prevent abuse
interface RateLimit {
  count: number;
  resetTime: number;
}
const rateLimits = new Map<string, RateLimit>();
const MAX_REQUESTS_PER_MINUTE = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const limit = rateLimits.get(identifier);

  if (!limit || now > limit.resetTime) {
    rateLimits.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - 1 };
  }

  if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
    return { allowed: false, remaining: 0 };
  }

  limit.count++;
  rateLimits.set(identifier, limit);
  return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - limit.count };
}

// Cache for candle data (longer TTL since historical data doesn't change)
const candleCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute cache

// If Finnhub /stock/candle is forbidden for this key/plan, back off to avoid spamming 403s
let finnhubCandleForbiddenUntil = 0;
const FINNHUB_FORBIDDEN_BACKOFF_MS = 10 * 60 * 1000;

function getCached(key: string): any | null {
  const cached = candleCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    console.log(`Cache hit for ${key}`);
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any): void {
  candleCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

/**
 * Convert period to provider-specific parameters
 */
function getPeriodParams(period: string): {
  resolution: string;
  fromDays: number;
  tdInterval: string;
  tdOutputsize: number;
} {
  switch (period) {
    case '1H':
    case '1D':
      return { resolution: '5', fromDays: 1, tdInterval: '5min', tdOutputsize: 288 }; // ~1d of 5-min bars
    case '1W':
      return { resolution: '60', fromDays: 7, tdInterval: '1h', tdOutputsize: 200 }; // ~1w of hourly bars
    case '1M':
      return { resolution: 'D', fromDays: 30, tdInterval: '1day', tdOutputsize: 50 };
    case '3M':
      return { resolution: 'D', fromDays: 90, tdInterval: '1day', tdOutputsize: 140 };
    case '1Y':
      return { resolution: 'D', fromDays: 365, tdInterval: '1day', tdOutputsize: 320 };
    case 'MAX':
      return { resolution: 'W', fromDays: 365 * 5, tdInterval: '1week', tdOutputsize: 320 };
    default:
      return { resolution: 'D', fromDays: 30, tdInterval: '1day', tdOutputsize: 50 };
  }
}

/**
 * Fetch candle data from Finnhub
 */
async function fetchFinnhubCandles(
  symbol: string,
  resolution: string,
  from: number,
  to: number,
  apiKey: string
): Promise<any> {
  try {
    if (Date.now() < finnhubCandleForbiddenUntil) {
      return null;
    }

    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;
    console.log(`Fetching candles: ${url.replace(apiKey, 'XXX')}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'UnifiedMarket/1.0' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Finnhub candle API error: ${response.status}`);
      if (response.status === 403) {
        finnhubCandleForbiddenUntil = Date.now() + FINNHUB_FORBIDDEN_BACKOFF_MS;
      }
      return null;
    }

    const data = await response.json();

    // Finnhub returns: c (close), h (high), l (low), o (open), t (timestamp), v (volume), s (status)
    if (data.s === 'no_data' || !data.c || data.c.length === 0) {
      console.log(`No candle data for ${symbol}`);
      return null;
    }
    
    // Transform to array of candle objects
    const candles = data.t.map((timestamp: number, i: number) => ({
      timestamp: timestamp * 1000, // Convert to milliseconds
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i]
    }));
    
    console.log(`Got ${candles.length} candles for ${symbol}`);
    return candles;
  } catch (error) {
    console.error(`Error fetching candles for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch candle data from Twelve Data (fallback for Finnhub 403 / plan restrictions)
 */
async function fetchTwelveDataCandles(
  symbol: string,
  interval: string,
  outputsize: number,
  apiKey: string
): Promise<any[] | null> {
  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${outputsize}&format=JSON&apikey=${apiKey}`;
    console.log(`Fetching Twelve Data candles: ${url.replace(apiKey, 'XXX')}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'UnifiedMarket/1.0' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Twelve Data API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data?.status === 'error' || data?.code) {
      console.error(`Twelve Data error for ${symbol}:`, data?.message || data);
      return null;
    }

    const values = data?.values;
    if (!Array.isArray(values) || values.length === 0) {
      console.log(`No Twelve Data candle data for ${symbol}`);
      return null;
    }

    // Twelve Data returns newest-first; normalize to oldest-first.
    const candles = values
      .map((v: any) => ({
        timestamp: new Date(v.datetime).getTime(),
        open: Number(v.open),
        high: Number(v.high),
        low: Number(v.low),
        close: Number(v.close),
        volume: v.volume !== undefined ? Number(v.volume) : null,
      }))
      .filter((c: any) => Number.isFinite(c.timestamp) && Number.isFinite(c.close))
      .sort((a: any, b: any) => a.timestamp - b.timestamp);

    console.log(`Got ${candles.length} candles for ${symbol} (Twelve Data)`);
    return candles;
  } catch (error) {
    console.error(`Error fetching Twelve Data candles for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch candle data from Alpha Vantage (fallback for when Twelve Data rate limit is hit)
 * Good for ETFs like UVXY, SHY, IEF that Finnhub doesn't support
 */
async function fetchAlphaVantageCandles(
  symbol: string,
  outputsize: 'compact' | 'full',
  apiKey: string
): Promise<any[] | null> {
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=${outputsize}&apikey=${apiKey}`;
    console.log(`Fetching Alpha Vantage candles: ${url.replace(apiKey, 'XXX')}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'UnifiedMarket/1.0' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Alpha Vantage API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Check for rate limit or errors
    if (data['Note'] || data['Error Message'] || data['Information']) {
      console.error('Alpha Vantage rate limit or error:', data['Note'] || data['Error Message'] || data['Information']);
      return null;
    }

    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) {
      console.log(`No Alpha Vantage candle data for ${symbol}`);
      return null;
    }

    // Convert to array of candle objects, sorted oldest-first
    const candles = Object.entries(timeSeries)
      .map(([date, values]: [string, any]) => ({
        timestamp: new Date(date).getTime(),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseInt(values['5. volume'], 10),
      }))
      .filter((c) => Number.isFinite(c.timestamp) && Number.isFinite(c.close))
      .sort((a, b) => a.timestamp - b.timestamp);

    console.log(`Got ${candles.length} candles for ${symbol} (Alpha Vantage)`);
    return candles;
  } catch (error) {
    console.error(`Error fetching Alpha Vantage candles for ${symbol}:`, error);
    return null;
  }
}

/**
 * This is the PRIMARY source for indicators to reduce load on Finnhub/Twelve Data
 */
async function fetchAlphaVantageIndicators(
  symbol: string,
  apiKey: string
): Promise<any | null> {
  try {
    // Fetch RSI, MACD, SMA, and EMA in parallel
    const [rsiRes, macdRes, sma20Res, sma50Res, ema12Res, ema26Res, bbRes] = await Promise.all([
      fetch(`https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${apiKey}`),
      fetch(`https://www.alphavantage.co/query?function=MACD&symbol=${symbol}&interval=daily&series_type=close&apikey=${apiKey}`),
      fetch(`https://www.alphavantage.co/query?function=SMA&symbol=${symbol}&interval=daily&time_period=20&series_type=close&apikey=${apiKey}`),
      fetch(`https://www.alphavantage.co/query?function=SMA&symbol=${symbol}&interval=daily&time_period=50&series_type=close&apikey=${apiKey}`),
      fetch(`https://www.alphavantage.co/query?function=EMA&symbol=${symbol}&interval=daily&time_period=12&series_type=close&apikey=${apiKey}`),
      fetch(`https://www.alphavantage.co/query?function=EMA&symbol=${symbol}&interval=daily&time_period=26&series_type=close&apikey=${apiKey}`),
      fetch(`https://www.alphavantage.co/query?function=BBANDS&symbol=${symbol}&interval=daily&time_period=20&series_type=close&apikey=${apiKey}`),
    ]);

    const [rsiData, macdData, sma20Data, sma50Data, ema12Data, ema26Data, bbData] = await Promise.all([
      rsiRes.json(),
      macdRes.json(),
      sma20Res.json(),
      sma50Res.json(),
      ema12Res.json(),
      ema26Res.json(),
      bbRes.json(),
    ]);

    // Check for API limit or errors
    if (rsiData['Note'] || rsiData['Error Message'] || macdData['Note'] || macdData['Error Message']) {
      console.error('Alpha Vantage rate limit or error:', rsiData['Note'] || rsiData['Error Message'] || macdData['Note']);
      return null;
    }

    // Extract latest values
    const getLatestValue = (data: any, key: string, valueKey: string): number | null => {
      const series = data?.[key];
      if (!series) return null;
      const dates = Object.keys(series).sort().reverse();
      if (dates.length === 0) return null;
      return parseFloat(series[dates[0]][valueKey]);
    };

    const rsi = getLatestValue(rsiData, 'Technical Analysis: RSI', 'RSI');
    const macdLine = getLatestValue(macdData, 'Technical Analysis: MACD', 'MACD');
    const macdSignal = getLatestValue(macdData, 'Technical Analysis: MACD', 'MACD_Signal');
    const macdHist = getLatestValue(macdData, 'Technical Analysis: MACD', 'MACD_Hist');
    const sma20 = getLatestValue(sma20Data, 'Technical Analysis: SMA', 'SMA');
    const sma50 = getLatestValue(sma50Data, 'Technical Analysis: SMA', 'SMA');
    const ema12 = getLatestValue(ema12Data, 'Technical Analysis: EMA', 'EMA');
    const ema26 = getLatestValue(ema26Data, 'Technical Analysis: EMA', 'EMA');
    const upperBand = getLatestValue(bbData, 'Technical Analysis: BBANDS', 'Real Upper Band');
    const lowerBand = getLatestValue(bbData, 'Technical Analysis: BBANDS', 'Real Lower Band');
    const middleBand = getLatestValue(bbData, 'Technical Analysis: BBANDS', 'Real Middle Band');

    // Validate we got essential data
    if (rsi === null || macdLine === null) {
      console.log('Alpha Vantage returned incomplete indicator data');
      return null;
    }

    console.log(`Got Alpha Vantage indicators for ${symbol}: RSI=${rsi?.toFixed(2)}, MACD=${macdLine?.toFixed(4)}`);

    return {
      rsi,
      macdLine,
      macdSignal: macdSignal ?? 0,
      macdHistogram: macdHist ?? 0,
      sma20: sma20 ?? 0,
      sma50: sma50 ?? 0,
      ema12: ema12 ?? 0,
      ema26: ema26 ?? 0,
      upperBand: upperBand ?? 0,
      lowerBand: lowerBand ?? 0,
      middleBand: middleBand ?? 0,
      currentPrice: middleBand ?? 0, // Will be overwritten by actual price if available
      source: 'alpha_vantage',
    };
  } catch (error) {
    console.error(`Error fetching Alpha Vantage indicators for ${symbol}:`, error);
    return null;
  }
}

/**
 * Calculate technical indicators from candle data
 */
function calculateIndicators(candles: any[]) {
  if (!candles || candles.length < 26) {
    return null;
  }
  
  const closes = candles.map(c => c.close);
  
  // Simple Moving Averages
  const sma = (data: number[], period: number): number => {
    if (data.length < period) return 0;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  };
  
  // Exponential Moving Average
  const ema = (data: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const emaValues: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
      emaValues.push(data[i] * k + emaValues[i - 1] * (1 - k));
    }
    return emaValues;
  };
  
  // RSI calculation
  const calculateRSI = (data: number[], period: number = 14): number => {
    if (data.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = data.length - period; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };
  
  // MACD calculation
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
  const signalLine = ema(ema12.slice(-9).map((v, i) => v - ema26[ema26.length - 9 + i]), 9);
  const macdSignal = signalLine[signalLine.length - 1] || 0;
  const macdHistogram = macdLine - macdSignal;
  
  // Bollinger Bands
  const sma20 = sma(closes, 20);
  const stdDev = Math.sqrt(
    closes.slice(-20).reduce((sum, val) => sum + Math.pow(val - sma20, 2), 0) / 20
  );
  
  const currentPrice = closes[closes.length - 1];
  
  return {
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    ema12: ema12[ema12.length - 1],
    ema26: ema26[ema26.length - 1],
    rsi: calculateRSI(closes),
    macdLine,
    macdSignal,
    macdHistogram,
    upperBand: sma20 + (stdDev * 2),
    lowerBand: sma20 - (stdDev * 2),
    middleBand: sma20,
    currentPrice
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting by IP
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please wait before making more requests.' }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } 
        }
      );
    }

    const { symbol, period = '1D', includeIndicators = false } = await req.json();

    const normalizedSymbol = String(symbol || '')
      .trim()
      .toUpperCase();

    if (!normalizedSymbol) {
      throw new Error('Symbol is required');
    }

    const finnhubKey = Deno.env.get('FINNHUB_API_KEY');
    const twelveDataKey = Deno.env.get('TWELVE_DATA_API_KEY');
    const alphaVantageKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');

    if (!finnhubKey && !twelveDataKey && !alphaVantageKey) {
      throw new Error('No market data API keys configured (FINNHUB_API_KEY, TWELVE_DATA_API_KEY, or ALPHA_VANTAGE_API_KEY)');
    }

    const cacheKey = `${normalizedSymbol}-${period}`;
    let candles = getCached(cacheKey);

    if (!candles) {
      const { resolution, fromDays, tdInterval, tdOutputsize } = getPeriodParams(period);
      const to = Math.floor(Date.now() / 1000);
      const from = to - (fromDays * 24 * 60 * 60);

      // ETFs that Finnhub doesn't support well - use Alpha Vantage as PRIMARY for these
      const etfSymbols = ['SHY', 'IEF', 'UVXY', 'TLT', 'SPY', 'QQQ', 'VXX', 'VIXY'];
      const isEtf = etfSymbols.includes(normalizedSymbol);

      if (isEtf && alphaVantageKey) {
        // PRIMARY for ETFs: Alpha Vantage (Finnhub returns 403, Twelve Data has tight rate limits)
        console.log(`Using Alpha Vantage as primary for ETF: ${normalizedSymbol}`);
        const avOutputsize = fromDays > 100 ? 'full' : 'compact';
        const avCandles = await fetchAlphaVantageCandles(normalizedSymbol, avOutputsize, alphaVantageKey);
        
        if (avCandles && avCandles.length > 0) {
          const cutoffTime = Date.now() - (fromDays * 24 * 60 * 60 * 1000);
          candles = avCandles.filter(c => c.timestamp >= cutoffTime);
        }

        // Fallback to Twelve Data if Alpha Vantage fails for ETF
        if (!candles && twelveDataKey) {
          candles = await fetchTwelveDataCandles(normalizedSymbol, tdInterval, tdOutputsize, twelveDataKey);
        }
      } else {
        // PRIMARY for stocks: Finnhub → Twelve Data → Alpha Vantage
        candles = finnhubKey
          ? await fetchFinnhubCandles(normalizedSymbol, resolution, from, to, finnhubKey)
          : null;

        if (!candles && twelveDataKey) {
          candles = await fetchTwelveDataCandles(normalizedSymbol, tdInterval, tdOutputsize, twelveDataKey);
        }

        // Third fallback: Alpha Vantage
        if (!candles && alphaVantageKey) {
          const avOutputsize = fromDays > 100 ? 'full' : 'compact';
          const avCandles = await fetchAlphaVantageCandles(normalizedSymbol, avOutputsize, alphaVantageKey);
          
          if (avCandles && avCandles.length > 0) {
            const cutoffTime = Date.now() - (fromDays * 24 * 60 * 60 * 1000);
            candles = avCandles.filter(c => c.timestamp >= cutoffTime);
          }
        }
      }

      if (candles) {
        setCache(cacheKey, candles);
      }
    }

    if (!candles || candles.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No data available',
          candles: null,
          indicators: null,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // Return 200 but with null data so client can handle gracefully
        }
      );
    }

    let indicators = null;
    if (includeIndicators) {
      const indicatorCacheKey = `${normalizedSymbol}-indicators-${period}`;
      indicators = getCached(indicatorCacheKey);

      if (!indicators) {
        // PRIMARY: Try Alpha Vantage first (pre-calculated indicators, separate rate limit pool)
        const alphaVantageKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
        if (alphaVantageKey) {
          console.log(`Trying Alpha Vantage for ${normalizedSymbol} indicators...`);
          indicators = await fetchAlphaVantageIndicators(normalizedSymbol, alphaVantageKey);
          
          // Add current price from candles if we have it
          if (indicators && candles && candles.length > 0) {
            indicators.currentPrice = candles[candles.length - 1].close;
          }
        }

        // FALLBACK: Calculate from candle data if Alpha Vantage fails
        if (!indicators) {
          console.log(`Alpha Vantage unavailable, falling back to candle-based calculation for ${normalizedSymbol}`);
          
          const canComputeFromCurrentCandles =
            Array.isArray(candles) &&
            candles.length >= 26 &&
            ['1M', '3M', '1Y', 'MAX'].includes(period);

          let indicatorCandles = canComputeFromCurrentCandles ? candles : null;

          if (!indicatorCandles) {
            // Fetch ~3 months of daily data for accurate indicator calculation
            const to = Math.floor(Date.now() / 1000);
            const from = to - (90 * 24 * 60 * 60);

            indicatorCandles = finnhubKey
              ? await fetchFinnhubCandles(normalizedSymbol, 'D', from, to, finnhubKey)
              : null;

            if (!indicatorCandles && twelveDataKey) {
              indicatorCandles = await fetchTwelveDataCandles(normalizedSymbol, '1day', 140, twelveDataKey);
            }
          }

          if (indicatorCandles && indicatorCandles.length >= 26) {
            indicators = calculateIndicators(indicatorCandles);
            if (indicators) {
              indicators.source = 'calculated';
            }
          }
        }

        if (indicators) {
          setCache(indicatorCacheKey, indicators);
        }
      }
    }

    console.log(`Returning ${candles.length} candles for ${normalizedSymbol} (${period})`);

    return new Response(
      JSON.stringify({ candles, indicators }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in get-stock-candles:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
