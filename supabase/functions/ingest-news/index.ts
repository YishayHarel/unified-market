// Ingest News - pulls publisher RSS on a schedule, tags each headline with the
// tickers it mentions, and upserts into public.news_articles.
//
// Runs from cron rather than from user requests: publisher load then depends on
// the schedule instead of on how many people are on the site, and articles
// become queryable data (per ticker, per watchlist) instead of a list we throw
// away after rendering.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts"
import { aggregateFeeds, GENERAL_FEEDS, type Article } from "../_shared/rssNews.ts"
import { buildMatcher, extractTickers, type StockRef } from "../_shared/tickerTag.ts"

// Far above what any one poll returns, so aggregateFeeds keeps everything the
// feeds offered rather than trimming for a UI page size.
const INGEST_LIMIT = 500;

// PostgREST caps a response at 1000 rows regardless of the requested limit, so
// the universe has to be paged in. Ordering by market_cap is not an option:
// only 60 of ~30k rows have one populated, so a "top N" slice would be
// arbitrary and miss household names.
const UNIVERSE_PAGE_SIZE = 1000;
const UNIVERSE_MAX_PAGES = 40;

async function loadSymbolUniverse(
  supabase: ReturnType<typeof createClient>,
): Promise<StockRef[]> {
  const universe: StockRef[] = [];

  for (let page = 0; page < UNIVERSE_MAX_PAGES; page++) {
    const from = page * UNIVERSE_PAGE_SIZE;
    const { data, error } = await supabase
      .from("stocks")
      .select("symbol, name")
      .order("symbol", { ascending: true })
      .range(from, from + UNIVERSE_PAGE_SIZE - 1);

    if (error) {
      console.error(`Symbol universe page ${page} failed:`, error.message);
      break;
    }
    if (!data?.length) break;

    universe.push(...(data as StockRef[]));
    if (data.length < UNIVERSE_PAGE_SIZE) break;
  }

  return universe;
}

/**
 * Feeds append their own tracking parameters, so the same story arrives with
 * different query strings. Strip them so the unique index can do its job.
 */
function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return raw.split("?")[0];
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(origin);
  }

  // Writes to shared state on a schedule — never open to callers.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Supabase service credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const [articles, universe] = await Promise.all([
      aggregateFeeds(GENERAL_FEEDS, INGEST_LIMIT),
      loadSymbolUniverse(supabase),
    ]);

    const matcher = buildMatcher(universe);
    console.log(`Loaded ${universe.length} symbols, ${matcher.byName.size} name forms`);

    const rows = articles.map((article: Article) => ({
      url: canonicalUrl(article.url),
      title: article.title,
      description: article.description,
      source: article.source.name,
      image_url: article.urlToImage,
      published_at: article.publishedAt,
      // Tag on title plus summary: the ticker is often only in the summary.
      tickers: extractTickers(`${article.title} ${article.description}`, matcher),
    }));

    // Re-running must not create duplicates, and a re-fetched story should pick
    // up corrections, so conflicts on the natural key update in place.
    const { error: upsertError, count } = await supabase
      .from("news_articles")
      .upsert(rows, { onConflict: "url", ignoreDuplicates: false, count: "exact" });

    if (upsertError) {
      console.error("Upsert failed:", upsertError.message);
      return new Response(
        JSON.stringify({ error: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Best effort: a failed prune should not fail the ingest.
    const { error: pruneError } = await supabase.rpc("prune_old_news_articles");
    if (pruneError) console.warn("Prune failed:", pruneError.message);

    const tagged = rows.filter((row) => row.tickers.length > 0).length;
    console.log(`Ingested ${rows.length} articles (${tagged} with tickers)`);

    return new Response(
      JSON.stringify({
        ok: true,
        fetched: rows.length,
        upserted: count ?? rows.length,
        tagged,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("ingest-news failed:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
})
