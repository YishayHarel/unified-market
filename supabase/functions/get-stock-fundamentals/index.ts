// Get Stock Fundamentals - Fetches company financials from Finnhub API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { nextFinnhubKey, getFinnhubKeys } from "../_shared/api-keys.ts"
import { getCorsHeaders } from "../_shared/cors.ts"
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIdentifier,
  RATE_LIMIT_TIERS,
} from "../_shared/rate-limit.ts"

/**
 * Fundamentals barely move intraday, and this endpoint was the most expensive
 * thing on the site: five Finnhub calls per request, cached nowhere. Finnhub's
 * free tier allows sixty calls a minute in total, so twelve people opening a
 * stock page in the same minute exhausted the entire budget for the whole site.
 *
 * The cache lives in the database rather than in memory. Edge functions run
 * across isolates and each keeps its own copy, so an in-memory map only helps
 * when the request happens to land on a warm instance — measured here, three
 * identical requests in a row all missed. A table is shared by all of them,
 * which turns "five calls per page view" into "five calls per symbol per ten
 * minutes", and traffic concentrates hard on a handful of tickers.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function cacheGet(symbol: string): Promise<unknown | null> {
  const supabase = cacheClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('fundamentals_cache')
    .select('payload, fetched_at')
    .eq('symbol', symbol)
    .maybeSingle();

  if (error || !data) return null;
  if (Date.now() - Date.parse(data.fetched_at as string) > CACHE_TTL_MS) return null;
  return data.payload;
}

async function cacheSet(symbol: string, payload: unknown): Promise<void> {
  const supabase = cacheClient();
  if (!supabase) return;

  // Best effort: a cache write failing should never fail the request.
  const { error } = await supabase
    .from('fundamentals_cache')
    .upsert({ symbol, payload, fetched_at: new Date().toISOString() }, { onConflict: 'symbol' });

  if (error) console.error('[fundamentals] cache write:', error.message);
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const clientId = getClientIdentifier(req);
  const rateCheck = checkRateLimit(`fundamentals:${clientId}`, RATE_LIMIT_TIERS.data);
  if (!rateCheck.allowed) {
    return createRateLimitResponse(rateCheck, corsHeaders);
  }

  try {
    console.log('Get-stock-fundamentals function called')
    
    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json()
    } catch (e) {
      console.error('Error parsing request body:', e)
      throw new Error('Invalid request body')
    }
    
    const { symbol } = requestBody
    if (!symbol) {
      throw new Error('symbol is required')
    }
    
    const cached = await cacheGet(String(symbol).toUpperCase());
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
        status: 200,
      });
    }

    console.log(`Fetching fundamentals for symbol: ${symbol}`)

    const finnhubKey = nextFinnhubKey();
    if (!finnhubKey || !getFinnhubKeys().length) {
      console.error('FINNHUB_API_KEY or FINNHUB_API_KEYS not found in environment');
      throw new Error('FINNHUB_API_KEY not found');
    }

    // Fetch all data in parallel
    const [basicFinancialsResponse, profileResponse, recommendationResponse, priceTargetResponse, quoteResponse] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${symbol}&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`)
    ]);

    let fundamentals = {};
    let profile = {};
    let recommendationTrends = [];
    let priceTarget = null;
    let quote = null;

    // Process basic financials
    if (basicFinancialsResponse.ok) {
      const basicData = await basicFinancialsResponse.json();
      console.log(`Basic financials for ${symbol}:`, basicData);
      fundamentals = basicData.metric || {};
    } else {
      console.error(`Error fetching basic financials for ${symbol}: ${basicFinancialsResponse.status}`);
    }

    // Process profile
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      console.log(`Profile for ${symbol}:`, profileData);
      profile = profileData;
    } else {
      console.error(`Error fetching profile for ${symbol}: ${profileResponse.status}`);
    }

    // Process recommendations
    if (recommendationResponse.ok) {
      const recommendationData = await recommendationResponse.json();
      console.log(`Recommendations for ${symbol}:`, recommendationData);
      recommendationTrends = recommendationData || [];
    } else {
      console.error(`Error fetching recommendations for ${symbol}: ${recommendationResponse.status}`);
    }

    // Process price target
    if (priceTargetResponse.ok) {
      const priceTargetData = await priceTargetResponse.json();
      console.log(`Price target for ${symbol}:`, priceTargetData);
      priceTarget = priceTargetData;
    } else {
      console.error(`Error fetching price target for ${symbol}: ${priceTargetResponse.status}`);
    }

    // Process quote
    if (quoteResponse.ok) {
      const quoteData = await quoteResponse.json();
      console.log(`Quote for ${symbol}:`, quoteData);
      quote = quoteData;
    } else {
      console.error(`Error fetching quote for ${symbol}: ${quoteResponse.status}`);
    }

    // Build result with key metrics
    const result = {
      symbol,
      marketCapitalization: (profile as any).marketCapitalization || (fundamentals as any).marketCapitalization || null,
      peRatio: (fundamentals as any).peBasicExclExtraTTM || (fundamentals as any).peTTM || null,
      dividendYield: (fundamentals as any).dividendYieldIndicatedAnnual || (fundamentals as any).dividendYield || null,
      week52High: (fundamentals as any)['52WeekHigh'] || null,
      week52Low: (fundamentals as any)['52WeekLow'] || null,
      beta: (fundamentals as any).beta || null,
      eps: (fundamentals as any).epsBasicExclExtraTTM || null,
      revenue: (fundamentals as any).revenuesPerShareTTM || null,
      industry: (profile as any).finnhubIndustry || null,
      sector: (profile as any).gind || null,
      employeeCount: (profile as any).employeeTotal || null,
      sharesOutstanding: (profile as any).shareOutstanding || null,
      bookValue: (fundamentals as any).bookValuePerShareAnnual || null,
      recommendationTrends,
      priceTarget,
      quote
    };

    console.log(`Returning fundamentals for ${symbol}:`, result);

    // Only cache a real answer. Caching a response built from five failed
    // fetches would pin an empty stock page in place for ten minutes.
    if (result.marketCapitalization != null || result.quote != null) {
      await cacheSet(String(symbol).toUpperCase(), result);
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in get-stock-fundamentals function:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
