import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    
    console.log(`Fetching prices for symbols: ${symbols.join(', ')}`)
    
    const finnhubKey = Deno.env.get('FINNHUB_API_KEY')
    if (!finnhubKey) {
      console.error('FINNHUB_API_KEY not found in environment')
      throw new Error('FINNHUB_API_KEY not found')
    }

    // Use Promise.allSettled with timeout to prevent hanging
    const promises = symbols.map(async (symbol: string) => {
      try {
        console.log(`Fetching data for ${symbol}`)
        
        // Add timeout for each individual request
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout per symbol
        
        const response = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`,
          { 
            signal: controller.signal,
            headers: {
              'User-Agent': 'UnifiedMarket/1.0'
            }
          }
        )
        clearTimeout(timeoutId)
          
          if (!response.ok) {
            console.error(`Error fetching ${symbol}: ${response.status}`)
            return null
          }
          
          const data = await response.json()
          console.log(`${symbol} data:`, data)
          
          // Check if we got valid data
          if (data.c === 0 || data.c === null || data.c === undefined) {
            console.log(`No valid price data for ${symbol}`)
            return null
          }
          
          return {
            symbol,
            price: data.c,
            change: data.d,
            changePercent: data.dp,
            high: data.h,
            low: data.l,
            open: data.o,
            previousClose: data.pc
          }
        } catch (error) {
          console.error(`Error processing ${symbol}:`, error)
          return null
        }
      })

    const results = await Promise.allSettled(promises)
    const validPrices = results
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => (result as PromiseFulfilledResult<any>).value)
    console.log(`Returning ${validPrices.length} valid prices out of ${symbols.length} requested`)
    
    return new Response(
      JSON.stringify(validPrices),
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