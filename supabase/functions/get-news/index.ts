// Get News - aggregates publisher RSS for general headlines and combines
// Finnhub company-news with Yahoo's ticker feed for per-symbol requests.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { nextFinnhubKey, getFinnhubKeys } from "../_shared/api-keys.ts"
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
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

/**
 * Ingest runs every 15 minutes and the feeds carry hundreds of stories a day,
 * so nothing newer than this means the pipeline has stopped rather than the
 * news having gone quiet.
 */
const STALE_AFTER_HOURS = 6;

interface NewsRow {
  url: string;
  title: string;
  description: string | null;
  source: string;
  image_url: string | null;
  published_at: string;
  tickers: string[] | null;
  bull_count: number | null;
  bear_count: number | null;
}

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

/**
 * Client for reading the public news cache.
 *
 * Prefers the service role key: this project has legacy API keys disabled, and
 * the auto-injected SUPABASE_ANON_KEY is the legacy anon JWT, so it may be
 * rejected. Only headline rows and aggregate vote counts are ever returned, so
 * nothing private is exposed by the elevated read.
 */
function cacheClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function toArticle(row: NewsRow): Article & { tickers: string[]; bullCount: number; bearCount: number } {
  return {
    title: row.title,
    description: row.description ?? row.title,
    source: { name: row.source },
    publishedAt: row.published_at,
    url: row.url,
    urlToImage: row.image_url,
    tickers: row.tickers ?? [],
    bullCount: row.bull_count ?? 0,
    bearCount: row.bear_count ?? 0,
  };
}

/**
 * Reads from the ingest cache. Returns an empty array — rather than throwing —
 * whenever the cache cannot serve the request, so the caller can fall back to
 * live feeds.
 *
 * When a watchlist is supplied, articles mentioning those symbols are fetched
 * first and the rest of the page is topped up with general headlines. That is
 * the whole point of tagging: a feed about the user's own holdings is something
 * a generic aggregator cannot produce.
 */
async function readCachedNews(
  symbol: string | undefined,
  pageSize: number,
  watchlist: string[],
): Promise<ReturnType<typeof toArticle>[]> {
  const supabase = cacheClient();
  if (!supabase) return [];

  const select = 'url, title, description, source, image_url, published_at, tickers, bull_count, bear_count';

  try {
    if (symbol) {
      const { data, error } = await supabase
        .from('news_articles_with_sentiment')
        .select(select)
        .contains('tickers', [symbol])
        .order('published_at', { ascending: false })
        .limit(pageSize);
      if (error) throw error;
      return (data ?? []).map(toArticle);
    }

    const collected: NewsRow[] = [];
    const seen = new Set<string>();

    if (watchlist.length > 0) {
      const { data, error } = await supabase
        .from('news_articles_with_sentiment')
        .select(select)
        .overlaps('tickers', watchlist)
        .order('published_at', { ascending: false })
        .limit(pageSize);
      if (error) throw error;
      for (const row of data ?? []) {
        collected.push(row as NewsRow);
        seen.add((row as NewsRow).url);
      }
    }

    if (collected.length < pageSize) {
      const { data, error } = await supabase
        .from('news_articles_with_sentiment')
        .select(select)
        .order('published_at', { ascending: false })
        .limit(pageSize);
      if (error) throw error;
      for (const row of data ?? []) {
        if (collected.length >= pageSize) break;
        if (seen.has((row as NewsRow).url)) continue;
        collected.push(row as NewsRow);
        seen.add((row as NewsRow).url);
      }
    }

    return collected.map(toArticle);
  } catch (error) {
    console.warn('News cache read failed:', error instanceof Error ? error.message : error);
    return [];
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
    
    const { pageSize = 20, symbol, companyName, watchlist: rawWatchlist } = requestBody

    const sanitizedSymbol = symbol
      ? String(symbol).replace(/[^A-Za-z0-9.]/g, '').toUpperCase().slice(0, 10)
      : undefined;
    const validPageSize = Math.min(Math.max(1, Number(pageSize) || 20), 50);

    // Caller-supplied symbols only steer ordering — they never widen access, so
    // sanitising the shape is enough. Capped so one request cannot build a
    // pathological query.
    const watchlist: string[] = Array.isArray(rawWatchlist)
      ? rawWatchlist
          .map((s: unknown) => String(s).replace(/[^A-Za-z0-9.]/g, '').toUpperCase().slice(0, 10))
          .filter(Boolean)
          .slice(0, 50)
      : [];
    
    console.log(`Fetching news: symbol=${sanitizedSymbol}, pageSize=${validPageSize}`)
    
    // Preferred path: the cache that ingest-news fills on a schedule. Falls
    // through to fetching feeds live when the cache is empty (before the first
    // ingest, or if it has stalled), so news never simply disappears.
    const cached = await readCachedNews(sanitizedSymbol, validPageSize, watchlist);
    if (cached.length > 0) {
      // If ingest stalls the cache keeps serving, and yesterday's headlines look
      // current because nothing says otherwise. Report the age of the newest
      // article so the client can flag a stale feed instead of quietly
      // presenting old news as today's.
      const newest = cached.reduce(
        (max, a) => Math.max(max, Date.parse(a.publishedAt) || 0),
        0,
      );
      const ageHours = newest > 0 ? (Date.now() - newest) / 3_600_000 : null;
      // General news refills continuously; a symbol may legitimately have no
      // fresh coverage, so only the general feed is judged stale on age.
      const stale = !sanitizedSymbol && ageHours != null && ageHours > STALE_AFTER_HOURS;
      if (stale) {
        console.warn(`News cache is stale — newest article is ${ageHours!.toFixed(1)}h old`);
      }

      console.log(`Served ${cached.length} articles from cache`);
      return new Response(
        JSON.stringify({
          articles: cached,
          status: 'ok',
          source: 'cache',
          newestAgeHours: ageHours == null ? null : Number(ageHours.toFixed(1)),
          stale,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'max-age=120' },
          status: 200,
        },
      );
    }

    console.warn('News cache empty — falling back to live feeds');

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
