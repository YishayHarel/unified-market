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
    
    // Try multiple news sources for real-time updates
    const sources = [
      {
        name: 'NewsData.io',
        url: `https://newsdata.io/api/1/news?apikey=${Deno.env.get('NEWSDATA_API_KEY')}&country=us&category=business&size=${pageSize}`,
        key: 'NEWSDATA_API_KEY'
      },
      {
        name: 'NewsAPI.org',
        url: `https://newsapi.org/v2/everything?q=business&language=en&sortBy=publishedAt&pageSize=${pageSize}&apiKey=${Deno.env.get('NEWS_API_KEY')}`,
        key: 'NEWS_API_KEY'
      }
    ]

    // Try sources in order until one works
    let finalData = null
    let lastError = null

    for (const source of sources) {
      const apiKey = Deno.env.get(source.key)
      if (!apiKey) {
        console.log(`${source.name} API key not found, skipping...`)
        continue
      }

      try {
        console.log(`Trying ${source.name}...`)
        const url = source.url
        
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
        console.log(`${source.name} response status: ${response.status}`)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`${source.name} error: ${response.status} - ${errorText}`)
          lastError = new Error(`${source.name} error: ${response.status}`)
          continue
        }

        const data = await response.json()
        
        // Normalize the response format
        let articles = []
        if (source.name === 'NewsData.io' && data.results) {
          articles = data.results.map(article => ({
            title: article.title,
            description: article.description,
            url: article.link,
            urlToImage: article.image_url,
            publishedAt: article.pubDate,
            source: { name: article.source_id }
          }))
        } else if (data.articles) {
          articles = data.articles
        }

        console.log(`${source.name} returned ${articles.length} articles`)
        
        if (articles.length > 0) {
          finalData = { articles, totalResults: articles.length, status: 'ok' }
          break
        }
      } catch (error) {
        console.error(`Error with ${source.name}:`, error.message)
        lastError = error
        continue
      }
    }

    if (!finalData) {
      throw lastError || new Error('All news sources failed')
    }
    
    return new Response(
      JSON.stringify(finalData),
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