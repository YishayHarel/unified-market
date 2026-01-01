import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cache for candle data (longer TTL since historical data doesn't change)
const candleCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute cache

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
 * Convert period to Finnhub resolution and time range
 */
function getPeriodParams(period: string): { resolution: string; fromDays: number } {
  switch (period) {
    case '1H':
      return { resolution: '5', fromDays: 1 }; // 5-min candles, 1 day back
    case '1D':
      return { resolution: '5', fromDays: 1 }; // 5-min candles, 1 day
    case '1W':
      return { resolution: '60', fromDays: 7 }; // 1-hour candles, 7 days
    case '1M':
      return { resolution: 'D', fromDays: 30 }; // Daily candles, 30 days
    case '3M':
      return { resolution: 'D', fromDays: 90 }; // Daily candles, 90 days
    case '1Y':
      return { resolution: 'D', fromDays: 365 }; // Daily candles, 1 year
    case 'MAX':
      return { resolution: 'W', fromDays: 365 * 5 }; // Weekly candles, 5 years
    default:
      return { resolution: 'D', fromDays: 30 };
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
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;
    console.log(`Fetching candles: ${url.replace(apiKey, 'XXX')}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'UnifiedMarket/1.0' }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`Finnhub candle API error: ${response.status}`);
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
    
    if (!symbol) {
      throw new Error('Symbol is required');
    }
    
    const finnhubKey = Deno.env.get('FINNHUB_API_KEY');
    if (!finnhubKey) {
      throw new Error('FINNHUB_API_KEY not configured');
    }
    
    const cacheKey = `${symbol}-${period}`;
    let candles = getCached(cacheKey);
    
    if (!candles) {
      const { resolution, fromDays } = getPeriodParams(period);
      const to = Math.floor(Date.now() / 1000);
      const from = to - (fromDays * 24 * 60 * 60);
      
      candles = await fetchFinnhubCandles(symbol.toUpperCase(), resolution, from, to, finnhubKey);
      
      if (candles) {
        setCache(cacheKey, candles);
      }
    }
    
    if (!candles || candles.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No data available',
          candles: null,
          indicators: null
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 // Return 200 but with null data so client can handle gracefully
        }
      );
    }
    
    let indicators = null;
    if (includeIndicators) {
      // For indicators, we need more historical data
      const indicatorCacheKey = `${symbol}-indicators`;
      indicators = getCached(indicatorCacheKey);
      
      if (!indicators) {
        // Fetch 3 months of daily data for accurate indicator calculation
        const to = Math.floor(Date.now() / 1000);
        const from = to - (90 * 24 * 60 * 60);
        const indicatorCandles = await fetchFinnhubCandles(symbol.toUpperCase(), 'D', from, to, finnhubKey);
        
        if (indicatorCandles && indicatorCandles.length >= 26) {
          indicators = calculateIndicators(indicatorCandles);
          if (indicators) {
            setCache(indicatorCacheKey, indicators);
          }
        }
      }
    }
    
    console.log(`Returning ${candles.length} candles for ${symbol} (${period})`);
    
    return new Response(
      JSON.stringify({ candles, indicators }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in get-stock-candles:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
