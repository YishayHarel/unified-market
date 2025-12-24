import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Keywords that indicate irrelevant content
const IRRELEVANT_KEYWORDS = [
  'sports', 'nfl', 'nba', 'mlb', 'nhl', 'golf', 'tennis', 'soccer', 'football',
  'celebrity', 'entertainment', 'movie', 'tv show', 'netflix', 'streaming',
  'recipe', 'cooking', 'weather', 'horoscope', 'kardashian', 'reality tv',
  'wwe', 'wrestling', 'ufc', 'mma', 'boxing', 'esports', 'gaming'
];

// Keywords that indicate relevant financial content
const RELEVANT_KEYWORDS = [
  'stock', 'share', 'market', 'invest', 'trading', 'earnings', 'revenue',
  'profit', 'loss', 'dividend', 'ipo', 'merger', 'acquisition', 'ceo',
  'nasdaq', 'dow', 's&p', 'nyse', 'fed', 'interest rate', 'inflation',
  'gdp', 'economy', 'fiscal', 'monetary', 'bond', 'treasury', 'etf',
  'crypto', 'bitcoin', 'hedge fund', 'wall street', 'analyst', 'upgrade',
  'downgrade', 'rating', 'forecast', 'guidance', 'quarter', 'annual'
];

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
      pageSize = 30,
      symbol,
      companyName 
    } = requestBody
    
    console.log(`Fetching news: symbol=${symbol}, companyName=${companyName}, pageSize=${pageSize}`)
    
    const newsApiKey = Deno.env.get('NEWS_API_KEY')
    if (!newsApiKey) {
      console.error('NEWS_API_KEY not found in environment')
      throw new Error('NEWS_API_KEY not found')
    }

    // Get news from last 24 hours only
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const fromDate = yesterday.toISOString().split('T')[0];

    // Build search query based on whether we have a specific stock or general news
    let searchQuery: string;
    
    if (symbol) {
      // Stock-specific search
      const companySearch = companyName 
        ? `"${companyName}" OR "${symbol}"` 
        : `"${symbol}"`;
      searchQuery = `${companySearch}`;
      console.log(`Stock-specific search query: ${searchQuery}`);
    } else {
      // General financial news - focused keywords
      searchQuery = '"stock market" OR "wall street" OR nasdaq OR "dow jones" OR "s&p 500" OR earnings OR "interest rate" OR "federal reserve"';
      console.log('General financial news search');
    }

    const encodedQuery = encodeURIComponent(searchQuery);
    // Request more articles so we have buffer after filtering
    const requestSize = Math.min(pageSize * 2, 100);
    const url = `https://newsapi.org/v2/everything?q=${encodedQuery}&language=en&sortBy=publishedAt&from=${fromDate}&pageSize=${requestSize}&apiKey=${newsApiKey}`;
    
    console.log(`Calling NewsAPI with from=${fromDate}...`);
    
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
    
    // Filter out invalid articles
    const validArticles = (data.articles || []).filter((article: any) => {
      if (!article.title || article.title === '[Removed]') return false;
      if (!article.description || article.description === '[Removed]') return false;
      if (!article.url) return false;
      return true;
    });
    
    // Filter for relevance - remove irrelevant topics
    const relevantArticles = validArticles.filter((article: any) => {
      const text = `${article.title} ${article.description}`.toLowerCase();
      
      // Check for irrelevant keywords
      const hasIrrelevant = IRRELEVANT_KEYWORDS.some(keyword => text.includes(keyword));
      if (hasIrrelevant) return false;
      
      // For general news (not stock-specific), require at least one relevant keyword
      if (!symbol) {
        const hasRelevant = RELEVANT_KEYWORDS.some(keyword => text.includes(keyword));
        if (!hasRelevant) return false;
      }
      
      return true;
    });
    
    console.log(`Filtered to ${relevantArticles.length} relevant articles`);
    
    // Deduplicate by similar titles
    const seenTitles = new Set<string>();
    const deduplicatedArticles = relevantArticles.filter((article: any) => {
      const normalizedTitle = article.title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50);
      
      if (seenTitles.has(normalizedTitle)) {
        return false;
      }
      seenTitles.add(normalizedTitle);
      return true;
    });
    
    // Limit to requested page size
    const finalArticles = deduplicatedArticles.slice(0, pageSize);
    
    console.log(`Final: ${finalArticles.length} articles after dedup and limit`)
    
    return new Response(
      JSON.stringify({ ...data, articles: finalArticles }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=180' // 3 minute cache for fresher news
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