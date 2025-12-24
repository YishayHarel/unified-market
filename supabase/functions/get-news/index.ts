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
    
    const { 
      category = 'business', 
      country = 'us', 
      pageSize = 20,
      symbol,
      companyName 
    } = requestBody
    
    console.log(`Fetching news: symbol=${symbol}, companyName=${companyName}, pageSize=${pageSize}`)
    
    const newsApiKey = Deno.env.get('NEWS_API_KEY')
    if (!newsApiKey) {
      console.error('NEWS_API_KEY not found in environment')
      throw new Error('NEWS_API_KEY not found')
    }

    // Build search query based on whether we have a specific stock or general news
    let searchQuery: string;
    
    if (symbol) {
      // Stock-specific search - include symbol and company name for better results
      const companySearch = companyName 
        ? `"${companyName}" OR ${symbol}` 
        : symbol;
      searchQuery = `(${companySearch}) AND (stock OR shares OR trading OR earnings OR market)`;
      console.log(`Stock-specific search query: ${searchQuery}`);
    } else {
      // General financial news
      searchQuery = '(stocks OR finance OR market OR "stock market" OR trading OR investing)';
      console.log('General financial news search');
    }

    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `https://newsapi.org/v2/everything?q=${encodedQuery}&language=en&sortBy=publishedAt&pageSize=${pageSize}&apiKey=${newsApiKey}`;
    
    console.log('Calling NewsAPI...');
    
    // Add timeout to prevent edge function timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    
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
    
    // Filter out articles with [Removed] content or missing essential data
    const validArticles = (data.articles || []).filter((article: any) => {
      return article.title && 
             article.title !== '[Removed]' && 
             article.description && 
             article.description !== '[Removed]' &&
             article.url;
    });
    
    // Deduplicate articles by similar titles (removes near-duplicates from different sources)
    const seenTitles = new Set<string>();
    const deduplicatedArticles = validArticles.filter((article: any) => {
      // Normalize title: lowercase, remove punctuation, extra spaces
      const normalizedTitle = article.title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50); // Compare first 50 chars to catch similar headlines
      
      if (seenTitles.has(normalizedTitle)) {
        return false;
      }
      seenTitles.add(normalizedTitle);
      return true;
    });
    
    console.log(`Filtered ${validArticles.length} valid articles, deduplicated to ${deduplicatedArticles.length}`)
    
    return new Response(
      JSON.stringify({ ...data, articles: deduplicatedArticles }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=300'
        },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in get-news function:', error.message)
    return new Response(
      JSON.stringify({ error: error.message, articles: [] }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})