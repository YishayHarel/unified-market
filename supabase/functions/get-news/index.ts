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
    const { category = 'business', country = 'us', pageSize = 20 } = await req.json()
    
    const newsApiKey = Deno.env.get('NEWS_API_KEY')
    if (!newsApiKey) {
      throw new Error('NEWS_API_KEY not found')
    }

    const response = await fetch(
      `https://newsapi.org/v2/top-headlines?category=${category}&country=${country}&pageSize=${pageSize}&apiKey=${newsApiKey}`
    )

    if (!response.ok) {
      throw new Error(`News API error: ${response.status}`)
    }

    const data = await response.json()
    
    return new Response(
      JSON.stringify(data),
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