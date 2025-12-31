import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple in-memory cache with TTL
const priceCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache for real-time feel

function getCached(symbol: string): any | null {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() < cached.expiry) {
    console.log(`Cache hit for ${symbol}`);
    return cached.data;
  }
  return null;
}

function setCache(symbol: string, data: any): void {
  priceCache.set(symbol, { data, expiry: Date.now() + CACHE_TTL_MS });
}

/**
 * Fetch price from Finnhub API
 */
async function fetchFinnhubPrice(symbol: string, apiKey: string): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`,
      { 
        signal: controller.signal,
        headers: { 'User-Agent': 'UnifiedMarket/1.0' }
      }
    );
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`Finnhub API error for ${symbol}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    // Finnhub returns: c (current), d (change), dp (percent change), h (high), l (low), o (open), pc (previous close)
    if (data && data.c && data.c > 0) {
      return {
        symbol,
        price: data.c,
        change: data.d || 0,
        changePercent: data.dp || 0,
        high: data.h || data.c,
        low: data.l || data.c,
        open: data.o || data.c,
        previousClose: data.pc || data.c,
        isFallback: false
      };
    }
    
    console.log(`No valid Finnhub data for ${symbol}:`, data);
    return null;
  } catch (error) {
    console.error(`Error fetching ${symbol} from Finnhub:`, error);
    return null;
  }
}

/**
 * Fetch prices for multiple symbols using Finnhub (one at a time due to API structure)
 */
async function fetchPricesWithFinnhub(symbols: string[], apiKey: string): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  
  console.log(`Fetching ${symbols.length} symbols from Finnhub`);
  
  // Finnhub free tier allows 60 calls/minute, so we can fetch in parallel with small batches
  const batchSize = 10;
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (symbol) => {
      const priceData = await fetchFinnhubPrice(symbol, apiKey);
      if (priceData) {
        setCache(symbol, priceData);
        results.set(symbol, priceData);
      }
    });
    
    await Promise.all(batchPromises);
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Get-stock-prices function called (Finnhub)')
    
    let requestBody;
    try {
      requestBody = await req.json()
    } catch (e) {
      console.error('Error parsing request body:', e)
      throw new Error('Invalid request body')
    }
    
    const { symbols } = requestBody
    if (!symbols || !Array.isArray(symbols)) {
      throw new Error('symbols array is required')
    }
    
    console.log(`Fetching prices for ${symbols.length} symbols:`, symbols.join(', '))
    
    const finnhubKey = Deno.env.get('FINNHUB_API_KEY')
    if (!finnhubKey) {
      console.error('FINNHUB_API_KEY not found')
      throw new Error('API key not configured');
    }

    // Check cache first and identify which symbols need fetching
    const results: any[] = [];
    const uncachedSymbols: string[] = [];
    
    for (const symbol of symbols as string[]) {
      const cached = getCached(symbol);
      if (cached) {
        results.push(cached);
      } else {
        uncachedSymbols.push(symbol);
      }
    }
    
    console.log(`${results.length} cached, ${uncachedSymbols.length} need fetching`);
    
    // Fetch uncached symbols from Finnhub
    if (uncachedSymbols.length > 0) {
      const fetchedPrices = await fetchPricesWithFinnhub(uncachedSymbols, finnhubKey);
      
      for (const symbol of uncachedSymbols) {
        const price = fetchedPrices.get(symbol);
        if (price) {
          results.push(price);
        }
      }
    }
    
    // Ensure results are in the same order as input symbols
    const orderedResults = symbols.map((symbol: string) => {
      const found = results.find(r => r.symbol === symbol);
      if (found) return found;
      
      // Return null indicator for missing symbols
      return {
        symbol,
        price: 0,
        change: 0,
        changePercent: 0,
        high: 0,
        low: 0,
        open: 0,
        previousClose: 0,
        isFallback: true,
        error: 'No data available'
      };
    });
    
    const realCount = orderedResults.filter(r => !r.isFallback).length;
    const fallbackCount = orderedResults.filter(r => r.isFallback).length;
    console.log(`Returning ${orderedResults.length} prices (${realCount} real, ${fallbackCount} no data)`)
    
    return new Response(
      JSON.stringify(orderedResults),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in get-stock-prices function:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})