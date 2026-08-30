// Fills in market capitalisations, so lists can be ranked by size.
//
// The stocks table holds 29,841 symbols and exactly 60 of them had a market
// cap. Everything that ranks by size therefore ranked by nothing: the earnings
// calendar sorts by date then market cap, but with every cap at zero the sort
// was stable and left Finnhub's alphabetical order intact. Opening the calendar
// showed Jianpu Technology, Cango, and four Nuveen closed-end funds — and no
// amount of "Load more" would ever reach Apple, because 2,000 rows sorted
// alphabetically do not surface the companies anyone came for.
//
// Backfilling all 29,841 is neither necessary nor affordable on a free key.
// What matters is the symbols people will actually see, so this walks the ones
// with earnings coming up, oldest-first, a few hundred per run. Coverage builds
// over a couple of hours and then only refreshes what has gone stale.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { nextFinnhubKey } from "../_shared/api-keys.ts";

/** Finnhub's free tier allows 60 calls a minute; stay comfortably inside it. */
const CALLS_PER_MINUTE = 50;
const CONCURRENCY = 5;

/**
 * How many symbols one run will attempt.
 *
 * At the pace above this is about two minutes of calling, which fits inside
 * the function's wall clock with room for the calendar lookup first. A larger
 * batch is not faster — the run is simply cut off partway.
 */
const BATCH_SIZE = 100;

/** A cap older than this is refreshed. Company size does not move that fast. */
const STALE_AFTER_DAYS = 7;

/** How far ahead to care about earnings — roughly what the calendar shows. */
const EARNINGS_HORIZON_DAYS = 45;

interface Target {
  symbol: string;
}

/** Symbols reporting earnings soon, which is what the calendar will show. */
async function upcomingEarningsSymbols(apiKey: string): Promise<string[]> {
  const today = new Date();
  const horizon = new Date(today.getTime() + EARNINGS_HORIZON_DAYS * 24 * 60 * 60 * 1000);

  // Finnhub truncates long ranges from the start, so ask in 14-day slices —
  // the same reason get-earnings does.
  const CHUNK_DAYS = 14;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const windows: Array<[string, string]> = [];
  for (let cursor = new Date(today); cursor <= horizon; ) {
    const end = new Date(Math.min(cursor.getTime() + (CHUNK_DAYS - 1) * DAY_MS, horizon.getTime()));
    windows.push([cursor.toISOString().split("T")[0], end.toISOString().split("T")[0]]);
    cursor = new Date(end.getTime() + DAY_MS);
  }

  const symbols = new Set<string>();
  for (const [from, to] of windows) {
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${apiKey}`,
        { headers: { "User-Agent": "UnifiedMarket/1.0" } },
      );
      if (!response.ok) continue;
      const data = await response.json();
      for (const row of data.earningsCalendar ?? []) {
        if (row?.symbol) symbols.add(String(row.symbol));
      }
    } catch (error) {
      console.error(`[update-market-caps] calendar ${from}..${to}:`, (error as Error).message);
    }
  }
  return [...symbols];
}

/** Market cap in dollars, or null when Finnhub has no profile for the symbol. */
async function fetchMarketCap(symbol: string, apiKey: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
      { headers: { "User-Agent": "UnifiedMarket/1.0" } },
    );
    if (!response.ok) return null;

    const profile = await response.json();
    // Finnhub reports this in millions.
    const millions = Number(profile?.marketCapitalization);
    if (!Number.isFinite(millions) || millions <= 0) return null;
    return millions * 1_000_000;
  } catch {
    return null;
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const apiKey = nextFinnhubKey();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "FINNHUB_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const candidates = await upcomingEarningsSymbols(apiKey);
    if (candidates.length === 0) {
      return new Response(JSON.stringify({ candidates: 0, updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only the ones we do not already have a fresh number for. Symbols missing
    // from the table entirely are skipped rather than invented — the universe
    // is maintained by update-top-100, not here.
    //
    // Freshness comes from market_cap_updated_at, not updated_at: the price and
    // ranking jobs both stamp updated_at for their own reasons, so it says
    // nothing about when the cap was last fetched.
    const staleBefore = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const targets: Target[] = [];
    // PostgREST caps `in` lists, so ask in slices.
    for (let i = 0; i < candidates.length && targets.length < BATCH_SIZE; i += 200) {
      const slice = candidates.slice(i, i + 200);
      const { data, error } = await supabase
        .from("stocks")
        .select("symbol")
        .in("symbol", slice)
        .or(`market_cap.is.null,market_cap_updated_at.is.null,market_cap_updated_at.lt.${staleBefore}`)
        .limit(BATCH_SIZE - targets.length);

      if (error) {
        console.error("[update-market-caps] target query:", error.message);
        break;
      }
      targets.push(...((data ?? []) as Target[]));
    }

    if (targets.length === 0) {
      return new Response(
        JSON.stringify({ candidates: candidates.length, targets: 0, updated: 0, note: "all fresh" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let updated = 0;
    let missing = 0;
    const startedAt = Date.now();

    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const batch = targets.slice(i, i + CONCURRENCY);
      const caps = await Promise.all(batch.map((t) => fetchMarketCap(t.symbol, apiKey)));

      for (let j = 0; j < batch.length; j++) {
        const cap = caps[j];
        if (cap == null) {
          missing++;
          continue;
        }
        const { error } = await supabase
          .from("stocks")
          .update({ market_cap: cap, market_cap_updated_at: new Date().toISOString() })
          .eq("symbol", batch[j].symbol);

        if (error) console.error(`[update-market-caps] ${batch[j].symbol}:`, error.message);
        else updated++;
      }

      // Pace the calls so a run cannot trip the provider's per-minute limit.
      const elapsed = Date.now() - startedAt;
      const allowance = ((i + CONCURRENCY) / CALLS_PER_MINUTE) * 60_000;
      if (allowance > elapsed) await new Promise((r) => setTimeout(r, allowance - elapsed));
    }

    console.log(
      `[update-market-caps] ${candidates.length} candidates, ${targets.length} targeted, ` +
        `${updated} updated, ${missing} without a profile`,
    );

    return new Response(
      JSON.stringify({ candidates: candidates.length, targets: targets.length, updated, missing }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[update-market-caps]", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
