// Get News - aggregates publisher RSS for general headlines and combines
// Finnhub company-news with Yahoo's ticker feed for per-symbol requests.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { nextFinnhubKey, getFinnhubKeys } from "../_shared/api-keys.ts"
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts"
import {
  aggregateFeeds,
  mergeArticles,
  symbolFeedUrl,
  GENERAL_FEEDS,
  type Article,
} from "../_shared/rssNews.ts"
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIdentifier,
  RATE_LIMIT_TIERS,
} from "../_shared/rate-limit.ts"

const FINNHUB_TIMEOUT_MS = 8000;

/** Finnhub's company-news endpoint: the best per-ticker source we have. */
async function fetchFinnhubCompanyNews(
  symbol: string,
  finnhubKey: string | null,
): Promise<Article[]> {
  if (!finnhubKey) return [];

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fromDate = weekAgo.toISOString().split('T')[0];
  const toDate = today.toISOString().split('T')[0];
  const url =
    `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}` +
    `&from=${fromDate}&to=${toDate}&token=${finnhubKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FINNHUB_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'UnifiedMarket/1.0' },
    });
    if (!response.ok) {
      console.error(`Finnhub company-news error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (Array.isArray(data) ? data : [])
      .filter((article: any) => article?.headline && article?.url)
      .map((article: any) => ({
        title: article.headline,
        description: article.summary || article.headline,
        source: { name: article.source || 'Finnhub' },
        publishedAt: new Date(article.datetime * 1000).toISOString(),
        url: article.url,
        urlToImage: article.image || null,
      }));
  } catch {
    // Falling back to RSS alone beats failing the whole request.
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(origin);
  }

  try {
    const clientId = getClientIdentifier(req);
    const rateCheck = checkRateLimit(`news:${clientId}`, RATE_LIMIT_TIERS.news);
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck, corsHeaders);
    }

    console.log(`Get-news called (client: ${clientId.slice(0, 24)}…, remaining: ${rateCheck.remaining})`)

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
    
    // General headlines come from publisher RSS; Finnhub is used for its
    // company-news endpoint, which is the better per-ticker source. A missing
    // key is no longer fatal — RSS alone still returns a usable feed.
    const finnhubKey = sanitizedSymbol ? nextFinnhubKey() : null;
    if (sanitizedSymbol && (!finnhubKey || !getFinnhubKeys().length)) {
      console.warn('FINNHUB_API_KEY not configured; serving symbol news from RSS only');
    }

    let deduplicatedArticles: Article[];

    if (sanitizedSymbol) {
      const [finnhubArticles, yahooArticles] = await Promise.all([
        fetchFinnhubCompanyNews(sanitizedSymbol, finnhubKey),
        aggregateFeeds(
          [{ name: 'Yahoo Finance', url: symbolFeedUrl(sanitizedSymbol) }],
          validPageSize,
        ),
      ]);
      deduplicatedArticles = mergeArticles(
        [...finnhubArticles, ...yahooArticles],
        validPageSize,
      );
      console.log(`Symbol news ${sanitizedSymbol}: ${finnhubArticles.length} finnhub + ${yahooArticles.length} rss`);
    } else {
      deduplicatedArticles = await aggregateFeeds(GENERAL_FEEDS, validPageSize);
      console.log('Fetched general market news from RSS feeds');
    }

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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
})
