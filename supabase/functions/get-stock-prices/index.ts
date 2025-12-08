import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple in-memory cache with TTL (survives across requests in the same instance)
const priceCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache

/**
 * Get cached price data or null if expired/missing
 */
function getCached(symbol: string): any | null {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() < cached.expiry) {
    console.log(`Cache hit for ${symbol}`);
    return cached.data;
  }
  return null;
}

/**
 * Store price data in cache
 */
function setCache(symbol: string, data: any): void {
  priceCache.set(symbol, { data, expiry: Date.now() + CACHE_TTL_MS });
}

/**
 * Generate fallback price data when API is unavailable
 * Uses realistic base prices for major stocks
 */
function generateFallbackPrice(symbol: string): any {
  const basePrices: Record<string, number> = {
    'AAPL': 195.00, 'GOOGL': 175.00, 'MSFT': 420.00, 'TSLA': 250.00,
    'AMZN': 180.00, 'NVDA': 185.00, 'META': 560.00, 'NFLX': 650.00,
    'AMD': 140.00, 'INTC': 45.00, 'CRM': 330.00, 'ORCL': 175.00,
    'JPM': 220.00, 'V': 290.00, 'MA': 490.00, 'BAC': 40.00,
    'WMT': 170.00, 'JNJ': 155.00, 'PG': 165.00, 'KO': 60.00,
    'DIS': 110.00, 'PYPL': 80.00, 'ADBE': 520.00, 'CSCO': 55.00,
  };
  
  const basePrice = basePrices[symbol] || 100.00;
  const variation = (Math.random() - 0.5) * 4; // ±$2 variation
  const price = basePrice + variation;
  const change = (Math.random() - 0.5) * 6; // ±$3 change
  const changePercent = (change / price) * 100;
  
  return {
    symbol,
    price: parseFloat(price.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(4)),
    high: parseFloat((price + Math.abs(change) + 2).toFixed(2)),
    low: parseFloat((price - Math.abs(change) - 2).toFixed(2)),
    open: parseFloat((price - change).toFixed(2)),
    previousClose: parseFloat((price - change).toFixed(2)),
    isFallback: true
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Get-stock-prices function called')
    
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
    
    console.log(`Fetching prices for ${symbols.length} symbols`)
    
    const finnhubKey = Deno.env.get('FINNHUB_API_KEY')
    if (!finnhubKey) {
      console.error('FINNHUB_API_KEY not found, using fallback data')
      const fallbackData = symbols.map((s: string) => generateFallbackPrice(s));
      return new Response(
        JSON.stringify(fallbackData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const results: any[] = [];
    let rateLimitHit = false;
    
    // Process symbols with rate limit awareness
    for (const symbol of symbols as string[]) {
      // Check cache first
      const cached = getCached(symbol);
      if (cached) {
        results.push(cached);
        continue;
      }
      
      // If we already hit rate limit, use fallback for remaining symbols
      if (rateLimitHit) {
        console.log(`Using fallback for ${symbol} due to rate limit`);
        const fallback = generateFallbackPrice(symbol);
        results.push(fallback);
        continue;
      }
      
      try {
        console.log(`Fetching data for ${symbol}`)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        
        const response = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`,
          { 
            signal: controller.signal,
            headers: { 'User-Agent': 'UnifiedMarket/1.0' }
          }
        )
        clearTimeout(timeoutId)
        
        if (response.status === 429) {
          console.warn(`Rate limit hit for ${symbol}, switching to fallback mode`);
          rateLimitHit = true;
          const fallback = generateFallbackPrice(symbol);
          results.push(fallback);
          continue;
        }
        
        if (!response.ok) {
          console.error(`Error fetching ${symbol}: ${response.status}`)
          const fallback = generateFallbackPrice(symbol);
          results.push(fallback);
          continue;
        }
        
        const data = await response.json()
        console.log(`${symbol} data:`, data)
        
        // Check if we got valid data (c = current price)
        if (data.c === 0 || data.c === null || data.c === undefined) {
          console.log(`No valid price data for ${symbol}, using fallback`)
          const fallback = generateFallbackPrice(symbol);
          results.push(fallback);
          continue;
        }
        
        const priceData = {
          symbol,
          price: data.c,
          change: data.d,
          changePercent: data.dp,
          high: data.h,
          low: data.l,
          open: data.o,
          previousClose: data.pc
        };
        
        // Cache successful response
        setCache(symbol, priceData);
        results.push(priceData);
        
        // Small delay to avoid hitting rate limits (60 calls/min = 1 per second)
        if (symbols.indexOf(symbol) < symbols.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`Error processing ${symbol}:`, error)
        const fallback = generateFallbackPrice(symbol);
        results.push(fallback);
      }
    }
    
    console.log(`Returning ${results.length} prices (${results.filter(r => !r.isFallback).length} real, ${results.filter(r => r.isFallback).length} fallback)`)
    
    return new Response(
      JSON.stringify(results),
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