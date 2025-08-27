import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { symbols } = await req.json()
    
    const finnhubKey = Deno.env.get('FINNHUB_API_KEY')
    if (!finnhubKey) {
      throw new Error('FINNHUB_API_KEY not found')
    }

    const prices = await Promise.all(
      symbols.map(async (symbol: string) => {
        const response = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`
        )
        
        if (!response.ok) {
          console.error(`Error fetching ${symbol}: ${response.status}`)
          return null
        }
        
        const data = await response.json()
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
      })
    )

    const validPrices = prices.filter(p => p !== null)
    
    return new Response(
      JSON.stringify(validPrices),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})