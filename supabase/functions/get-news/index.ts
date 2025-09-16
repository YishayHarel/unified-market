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
    console.log('Get-news function called')
    
    let requestBody;
    try {
      requestBody = await req.json()
    } catch (e) {
      console.log('No JSON body provided, using defaults')
      requestBody = {}
    }
    
    const { category = 'business', country = 'us', pageSize = 20 } = requestBody
    console.log(`Fetching news: category=${category}, country=${country}, pageSize=${pageSize}`)
    
    const newsApiKey = Deno.env.get('NEWS_API_KEY')
    if (!newsApiKey) {
      console.error('NEWS_API_KEY not found in environment')
      throw new Error('NEWS_API_KEY not found')
    }

    // Use everything endpoint for more recent news
    const url = `https://newsapi.org/v2/everything?q=(stocks OR finance OR market OR business)&language=en&sortBy=publishedAt&pageSize=${pageSize}&apiKey=${newsApiKey}`
    console.log('Calling NewsAPI for recent business/finance news...')
    
    // Add timeout to prevent edge function timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'UnifiedMarket/1.0'
      }
    })
    clearTimeout(timeoutId)
    console.log(`NewsAPI response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`NewsAPI error: ${response.status} - ${errorText}`)
      throw new Error(`NewsAPI error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`NewsAPI returned ${data.articles?.length || 0} articles`)
    
    return new Response(
      JSON.stringify(data),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=300' // Cache for 5 minutes only
        },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in get-news function:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})