// Get News - Fetches financial news from Finnhub with rate limiting

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

// Rate limiting
interface RateLimit {
  count: number;
  resetTime: number;
}
const rateLimits = new Map<string, RateLimit>();
const MAX_REQUESTS_PER_MINUTE = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// Checks rate limit for identifier
function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const limit = rateLimits.get(identifier);

  if (!limit || now > limit.resetTime) {
    rateLimits.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - 1 };
  }

  if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
    return { allowed: false, remaining: 0 };
  }

  limit.count++;
  rateLimits.set(identifier, limit);
  return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - limit.count };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Rate limit by IP
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 'unknown';
    
    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', articles: [] }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
      );
    }

    console.log(`Get-news called (IP: ${clientIP}, remaining: ${rateCheck.remaining})`)

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json()
    } catch (e) {
      console.log('No JSON body provided, using defaults')
      requestBody = {}
    }
    
    const { pageSize = 20, symbol, companyName } = requestBody
    
    // Sanitize inputs
    const sanitizedSymbol = symbol 
      ? String(symbol).replace(/[^A-Za-z0-9.]/g, '').toUpperCase().slice(0, 10)
      : undefined;
    const validPageSize = Math.min(Math.max(1, Number(pageSize) || 20), 50);
    
    console.log(`Fetching news: symbol=${sanitizedSymbol}, pageSize=${validPageSize}`)
    
    const finnhubKey = Deno.env.get('FINNHUB_API_KEY')
    if (!finnhubKey) {
      console.error('FINNHUB_API_KEY not found in environment')
      throw new Error('FINNHUB_API_KEY not found')
    }

    // Build URL based on whether we have a symbol
    let url: string;
    if (sanitizedSymbol) {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fromDate = weekAgo.toISOString().split('T')[0];
      const toDate = today.toISOString().split('T')[0];
      url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(sanitizedSymbol)}&from=${fromDate}&to=${toDate}&token=${finnhubKey}`;
      console.log(`Fetching company news for ${sanitizedSymbol}`);
    } else {
      url = `https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`;
      console.log('Fetching general market news');
    }
    
    // Fetch with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'UnifiedMarket/1.0' }
    })
    clearTimeout(timeoutId)
    console.log(`Finnhub response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Finnhub error: ${response.status} - ${errorText}`)
      throw new Error(`Finnhub error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`Finnhub returned ${Array.isArray(data) ? data.length : 0} articles`)
    
    // Transform to frontend format
    const articles = (Array.isArray(data) ? data : [])
      .filter((article: any) => article.headline && article.url)
      .slice(0, validPageSize)
      .map((article: any) => ({
        title: article.headline,
        description: article.summary || article.headline,
        source: { name: article.source || 'Finnhub' },
        publishedAt: new Date(article.datetime * 1000).toISOString(),
        url: article.url,
        urlToImage: article.image || null
      }));
    
    // Deduplicate by similar titles
    const seenTitles = new Set<string>();
    const deduplicatedArticles = articles.filter((article: any) => {
      const normalizedTitle = article.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50);
      if (seenTitles.has(normalizedTitle)) return false;
      seenTitles.add(normalizedTitle);
      return true;
    });
    
    console.log(`Final: ${deduplicatedArticles.length} articles after processing`)
    
    return new Response(
      JSON.stringify({ articles: deduplicatedArticles, status: 'ok' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'max-age=120' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in get-news function:', error.message)
    return new Response(
      JSON.stringify({ error: error.message, articles: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
