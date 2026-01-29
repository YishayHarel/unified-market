// Get News - Fetches financial news from Finnhub with rate limiting
// STANDALONE VERSION - Use this if the shared import doesn't work

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// CORS configuration - inlined version
const PRODUCTION_ORIGINS = [
  'https://85a34aed-b2cd-4a8b-8664-ff1b782adf81.lovableproject.com',
  'https://lovable.dev',
  'https://unified-market.lovable.app',
  'https://unified-market.vercel.app',
];

const LOCAL_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PRODUCTION_ORIGINS.includes(origin)) return true;
  if (LOCAL_ORIGINS.includes(origin)) return true;
  if (origin.endsWith('.lovableproject.com') || origin.endsWith('.lovable.app')) return true;
  if (origin.endsWith('.vercel.app')) return true;
  return false;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : PRODUCTION_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin!,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
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
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    let requestBody;
    try {
      requestBody = await req.json()
    } catch (e) {
      console.log('No JSON body provided, using defaults')
      requestBody = {}
    }
    
    const { pageSize = 20, symbol, companyName } = requestBody
    
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
    console.error('Error in get-news function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    let userMessage = 'Unable to fetch news at this time';
    if (errorMessage.includes('FINNHUB_API_KEY')) {
      userMessage = 'News service configuration error';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
      userMessage = 'Request timed out. Please try again.';
    } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      userMessage = 'Too many requests. Please try again later.';
    }
    
    return new Response(
      JSON.stringify({ 
        error: userMessage, 
        articles: [],
        details: errorMessage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
