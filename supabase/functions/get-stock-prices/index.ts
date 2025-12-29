import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple in-memory cache with TTL
const priceCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

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
 * Generate fallback price data when API is unavailable
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
  const variation = (Math.random() - 0.5) * 4;
  const price = basePrice + variation;
  const change = (Math.random() - 0.5) * 6;
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

/**
 * Fetch prices using Twelve Data batch endpoint (up to 8 symbols per request)
 */
async function fetchTwelveDataBatch(symbols: string[], apiKey: string): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  
  // Twelve Data allows up to 8 symbols per batch request
  const batchSize = 8;
  const batches: string[][] = [];
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    batches.push(symbols.slice(i, i + batchSize));
  }
  
  console.log(`Processing ${batches.length} batch(es) for ${symbols.length} symbols`);
  
  for (const batch of batches) {
    const symbolsParam = batch.join(',');
    console.log(`Fetching batch: ${symbolsParam}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      // Use the quote endpoint which provides current price, change, etc.
      const response = await fetch(
        `https://api.twelvedata.com/quote?symbol=${symbolsParam}&apikey=${apiKey}`,
        { 
          signal: controller.signal,
          headers: { 'User-Agent': 'UnifiedMarket/1.0' }
        }
      );
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`Twelve Data API error: ${response.status}`);
        // Use fallback for all symbols in this batch
        for (const symbol of batch) {
          results.set(symbol, generateFallbackPrice(symbol));
        }
        continue;
      }
      
      const data = await response.json();
      console.log(`Twelve Data response:`, JSON.stringify(data).slice(0, 500));
      
      // Handle single symbol response (not wrapped in object)
      if (batch.length === 1) {
        const symbol = batch[0];
        if (data.close && data.close !== 'null') {
          const priceData = {
            symbol,
            price: parseFloat(data.close),
            change: parseFloat(data.change || '0'),
            changePercent: parseFloat(data.percent_change || '0'),
            high: parseFloat(data.high || data.close),
            low: parseFloat(data.low || data.close),
            open: parseFloat(data.open || data.close),
            previousClose: parseFloat(data.previous_close || data.close),
            volume: parseInt(data.volume || '0', 10),
            avgVolume: parseInt(data.average_volume || '0', 10)
          };
          results.set(symbol, priceData);
          setCache(symbol, priceData);
        } else {
          console.log(`No valid data for ${symbol}, using fallback`);
          results.set(symbol, generateFallbackPrice(symbol));
        }
      } else {
        // Handle multiple symbols response (wrapped in object by symbol)
        for (const symbol of batch) {
          const symbolData = data[symbol];
          
          if (symbolData && symbolData.close && symbolData.close !== 'null' && !symbolData.code) {
            const priceData = {
              symbol,
              price: parseFloat(symbolData.close),
              change: parseFloat(symbolData.change || '0'),
              changePercent: parseFloat(symbolData.percent_change || '0'),
              high: parseFloat(symbolData.high || symbolData.close),
              low: parseFloat(symbolData.low || symbolData.close),
              open: parseFloat(symbolData.open || symbolData.close),
              previousClose: parseFloat(symbolData.previous_close || symbolData.close),
              volume: parseInt(symbolData.volume || '0', 10),
              avgVolume: parseInt(symbolData.average_volume || '0', 10)
            };
            results.set(symbol, priceData);
            setCache(symbol, priceData);
          } else {
            console.log(`No valid data for ${symbol}, using fallback. Error:`, symbolData?.code || 'unknown');
            results.set(symbol, generateFallbackPrice(symbol));
          }
        }
      }
      
      // Small delay between batches to avoid rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } catch (error) {
      console.error(`Error fetching batch:`, error);
      for (const symbol of batch) {
        results.set(symbol, generateFallbackPrice(symbol));
      }
    }
  }
  
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Get-stock-prices function called (Twelve Data)')
    
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
    
    const twelveDataKey = Deno.env.get('TWELVE_DATA_API_KEY')
    if (!twelveDataKey) {
      console.error('TWELVE_DATA_API_KEY not found, using fallback data')
      const fallbackData = symbols.map((s: string) => generateFallbackPrice(s));
      return new Response(
        JSON.stringify(fallbackData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
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
    
    // Fetch uncached symbols using batch endpoint
    if (uncachedSymbols.length > 0) {
      const fetchedPrices = await fetchTwelveDataBatch(uncachedSymbols, twelveDataKey);
      
      // Add fetched prices to results in original order
      for (const symbol of uncachedSymbols) {
        const price = fetchedPrices.get(symbol);
        if (price) {
          results.push(price);
        }
      }
    }
    
    // Ensure results are in the same order as input symbols
    const orderedResults = symbols.map((symbol: string) => 
      results.find(r => r.symbol === symbol) || generateFallbackPrice(symbol)
    );
    
    console.log(`Returning ${orderedResults.length} prices (${orderedResults.filter(r => !r.isFallback).length} real, ${orderedResults.filter(r => r.isFallback).length} fallback)`)
    
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
