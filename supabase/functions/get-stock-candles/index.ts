import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, period = '1D', includeIndicators = false } = await req.json();

    const normalizedSymbol = String(symbol || '')
      .trim()
      .toUpperCase();

    if (!normalizedSymbol) {
      throw new Error('Symbol is required');
    }

    const finnhubKey = Deno.env.get('FINNHUB_API_KEY');
    const twelveDataKey = Deno.env.get('TWELVE_DATA_API_KEY');

    if (!finnhubKey && !twelveDataKey) {
      throw new Error('No market data API keys configured (FINNHUB_API_KEY or TWELVE_DATA_API_KEY)');
    }

    const cacheKey = `${normalizedSymbol}-${period}`;
    let candles = getCached(cacheKey);

    if (!candles) {
      const { resolution, fromDays, tdInterval, tdOutputsize } = getPeriodParams(period);
      const to = Math.floor(Date.now() / 1000);
      const from = to - (fromDays * 24 * 60 * 60);

      candles = finnhubKey
        ? await fetchFinnhubCandles(normalizedSymbol, resolution, from, to, finnhubKey)
        : null;

      if (!candles && twelveDataKey) {
        candles = await fetchTwelveDataCandles(normalizedSymbol, tdInterval, tdOutputsize, twelveDataKey);
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
      // IMPORTANT: Avoid extra upstream API calls for indicators when we already have enough candles.
      // This prevents hitting Twelve Data per-minute credit limits when multiple analytics widgets load.
      const indicatorCacheKey = `${normalizedSymbol}-indicators-${period}`;
      indicators = getCached(indicatorCacheKey);

      if (!indicators) {
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
            setCache(indicatorCacheKey, indicators);
          }
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
