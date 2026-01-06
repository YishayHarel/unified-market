// Get Earnings - Fetches earnings calendar from Finnhub with market cap enrichment

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://85a34aed-b2cd-4a8b-8664-ff1b782adf81.lovableproject.com',
  'https://lovable.dev',
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

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { from, to, symbol } = await req.json()
    
    const apiKey = Deno.env.get('FINNHUB_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build Finnhub URL
    const params = new URLSearchParams({ token: apiKey })
    if (from) params.append('from', from)
    if (to) params.append('to', to)
    if (symbol) params.append('symbol', symbol)

    console.log(`Fetching earnings from ${from} to ${to}${symbol ? ` for ${symbol}` : ''}`)

    // Fetch with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?${params.toString()}`,
      { signal: controller.signal, headers: { 'User-Agent': 'UnifiedMarket/1.0' } }
    )
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`Received ${data.earningsCalendar?.length || 0} earnings records`)
    
    // Enrich with market cap if we have data
    if (data.earningsCalendar && data.earningsCalendar.length > 0) {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      // Get unique symbols
      const symbols = [...new Set(data.earningsCalendar.map((e: any) => e.symbol))]
      console.log(`Looking up market cap for ${symbols.length} symbols`)
      
      // Fetch stock data
      const { data: stocks } = await supabase
        .from('stocks')
        .select('symbol, name, market_cap')
        .in('symbol', symbols)
      
      // Create lookup map
      const stockMap = new Map()
      stocks?.forEach(stock => stockMap.set(stock.symbol, stock))
      
      // Enrich earnings with market cap
      const enrichedEarnings = data.earningsCalendar.map((earning: any) => {
        const stockInfo = stockMap.get(earning.symbol)
        return {
          ...earning,
          market_cap: stockInfo?.market_cap || 0,
          company_name: stockInfo?.name || earning.symbol
        }
      })
      
      // Sort by date first, then by market cap
      enrichedEarnings.sort((a: any, b: any) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        if (dateA !== dateB) return dateA - dateB
        return (b.market_cap || 0) - (a.market_cap || 0)
      })
      
      console.log(`Returning ${enrichedEarnings.length} enriched earnings`)
      
      return new Response(
        JSON.stringify({ earningsCalendar: enrichedEarnings, totalCount: enrichedEarnings.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error fetching earnings:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch earnings data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
