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

    const url = `https://newsapi.org/v2/top-headlines?category=${category}&country=${country}&pageSize=${pageSize}&apiKey=${newsApiKey}`
    console.log('Calling News API...')
    
    const response = await fetch(url)
    console.log(`News API response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`News API error: ${response.status} - ${errorText}`)
      throw new Error(`News API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`News API returned ${data.articles?.length || 0} articles`)
    
    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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