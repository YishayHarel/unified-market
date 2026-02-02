// Get Treasury & VIX - Fetches Treasury yields and VIX data from Alpha Vantage

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173'
];

// Returns CORS headers based on origin
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

// Data cache with 10 minute TTL
const dataCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function getCached(key: string): any | null {
  const cached = dataCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    console.log(`Cache hit for ${key}`);
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any): void {
  dataCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

// Fetches Treasury yield for given maturity
async function fetchTreasuryYield(
  maturity: string,
  apiKey: string
): Promise<{ data: Array<{ date: string; value: number }>; current: number; change: number } | null> {
  try {
    const url = `https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=${maturity}&apikey=${apiKey}`;
    console.log(`Fetching Treasury Yield (${maturity}): ${url.replace(apiKey, 'XXX')}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'UnifiedMarket/1.0' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Alpha Vantage Treasury API error: ${response.status}`);
      return null;
    }

    const json = await response.json();

    // Check for rate limit
    if (json['Note'] || json['Error Message'] || json['Information']) {
      console.error('Alpha Vantage rate limit or error:', json['Note'] || json['Error Message'] || json['Information']);
      return null;
    }

    const dataPoints = json['data'];
    if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
      console.log(`No Treasury Yield data for ${maturity}`);
      return null;
    }

    // Filter out missing data and convert to numbers
    const validData = dataPoints
      .filter((d: any) => d.value !== '.' && d.value !== null)
      .map((d: any) => ({ date: d.date, value: parseFloat(d.value) }))
      .filter((d: any) => !isNaN(d.value));

    if (validData.length < 2) {
      console.log(`Insufficient Treasury Yield data for ${maturity}`);
      return null;
    }

    // Data is newest-first
    const current = validData[0].value;
    const previous = validData[1].value;
    const change = current - previous;

    console.log(`Got Treasury Yield ${maturity}: ${current.toFixed(3)}% (change: ${change >= 0 ? '+' : ''}${change.toFixed(3)}%)`);

    return { data: validData.slice(0, 60).reverse(), current, change };
  } catch (error) {
    console.error(`Error fetching Treasury Yield ${maturity}:`, error);
    return null;
  }
}

// Fetches VIX data from Alpha Vantage
async function fetchVixData(
  apiKey: string
): Promise<{ data: Array<{ date: string; value: number }>; current: number; change: number } | null> {
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=VIX&outputsize=compact&apikey=${apiKey}`;
    console.log(`Fetching VIX: ${url.replace(apiKey, 'XXX')}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'UnifiedMarket/1.0' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Alpha Vantage VIX API error: ${response.status}`);
      return null;
    }

    const json = await response.json();

    // Check for rate limit
    if (json['Note'] || json['Error Message'] || json['Information']) {
      console.error('Alpha Vantage VIX rate limit or error:', json['Note'] || json['Error Message'] || json['Information']);
      return null;
    }

    const timeSeries = json['Time Series (Daily)'];
    if (!timeSeries) {
      console.log('No VIX time series data');
      return null;
    }

    // Convert to array, sorted newest-first
    const entries = Object.entries(timeSeries)
      .map(([date, values]: [string, any]) => ({ date, value: parseFloat(values['4. close']) }))
      .filter((d) => !isNaN(d.value))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (entries.length < 2) {
      console.log('Insufficient VIX data');
      return null;
    }

    const current = entries[0].value;
    const previous = entries[1].value;
    const change = current - previous;

    console.log(`Got VIX: ${current.toFixed(2)} (change: ${change >= 0 ? '+' : ''}${change.toFixed(2)})`);

    return { data: entries.slice(0, 60).reverse(), current, change };
  } catch (error) {
    console.error('Error fetching VIX:', error);
    return null;
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, maturity } = await req.json();
    
    const alphaVantageKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
    if (!alphaVantageKey) {
      throw new Error('ALPHA_VANTAGE_API_KEY not configured');
    }

    const cacheKey = type === 'vix' ? 'vix' : `treasury-${maturity}`;
    
    // Check cache first
    let result = getCached(cacheKey);
    
    if (!result) {
      if (type === 'vix') {
        result = await fetchVixData(alphaVantageKey);
      } else if (type === 'treasury') {
        const validMaturities = ['3month', '2year', '5year', '7year', '10year', '30year'];
        if (!validMaturities.includes(maturity)) {
          throw new Error(`Invalid maturity. Valid options: ${validMaturities.join(', ')}`);
        }
        result = await fetchTreasuryYield(maturity, alphaVantageKey);
      } else {
        throw new Error('Invalid type. Use "vix" or "treasury"');
      }
      
      if (result) setCache(cacheKey, result);
    }

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Unable to fetch data. API may be rate limited.', data: null }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-treasury-vix:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
