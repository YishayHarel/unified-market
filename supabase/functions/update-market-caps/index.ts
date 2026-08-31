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
import { TOP_100_SEED_SYMBOLS } from "../_shared/top100.ts";

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

/**
 * Currency implied by the exchange suffix on Finnhub's resolved ticker.
 *
 * Finnhub's own `currency` field cannot be trusted: it reports EQNR.OL — the
 * Oslo listing of Equinor — as USD while giving the market cap in kroner, which
 * put Equinor in the table at $918B against a real size near $75B. The suffix
 * is what actually identifies the listing, and it is a closed, stable list.
 *
 * London is the trap worth naming: .L is quoted in PENCE, not pounds, so its
 * rate is a hundredth of GBP.
 */
const EXCHANGE_CURRENCY: Record<string, string> = {
  OL: "NOK", TW: "TWD", TWO: "TWD", AS: "EUR", T: "JPY", PA: "EUR", DE: "EUR",
  F: "EUR", MI: "EUR", MC: "EUR", BR: "EUR", LS: "EUR", HE: "EUR", VI: "EUR",
  IR: "EUR", AT: "EUR", SW: "CHF", TO: "CAD", V: "CAD", HK: "HKD", SS: "CNY",
  SZ: "CNY", KS: "KRW", KQ: "KRW", ST: "SEK", CO: "DKK", AX: "AUD", NZ: "NZD",
  SA: "BRL", MX: "MXN", TA: "ILS", IS: "TRY", JO: "ZAR", NS: "INR", BO: "INR",
  SI: "SGD", BK: "THB", JK: "IDR", KL: "MYR", WA: "PLN", PR: "CZK", BD: "HUF",
};

/** Pence, not pounds — a hundredth of GBP. */
const PENCE_SUFFIXES = new Set(["L", "IL"]);

function currencyForTicker(ticker: string, reported: string): { currency: string; divisor: number } {
  const match = /\.([A-Z]+)$/.exec(ticker.toUpperCase());
  if (!match) {
    // No suffix means a US listing, where the reported currency is reliable.
    return { currency: reported, divisor: 1 };
  }

  const suffix = match[1];
  if (PENCE_SUFFIXES.has(suffix)) return { currency: "GBP", divisor: 100 };

  const mapped = EXCHANGE_CURRENCY[suffix];
  // An unmapped suffix is a listing this code has never seen. Falling back to
  // the reported currency is what produced the Equinor number, so prefer to
  // skip it: a missing company is recoverable, a wrong one is not.
  return mapped ? { currency: mapped, divisor: 1 } : { currency: "", divisor: 1 };
}

/**
 * Dollars per unit of a currency.
 *
 * Frankfurter first: it publishes the European Central Bank's daily reference
 * rates, is free and keyless, and is explicitly meant to be called — none of
 * which is true of Yahoo's undocumented endpoint, which is used here on
 * sufferance and could start refusing us without notice.
 *
 * The ECB set does not cover everything, though. Taiwan is the one that
 * matters: no TWD reference rate means no market cap for TSMC, so Yahoo stays
 * as a fallback for the handful of currencies Frankfurter does not carry.
 *
 * Cached for the life of the instance. A run touches a few currencies at most,
 * and a reference rate does not need to be to the minute to sort a company
 * into a size band.
 */
const fxCache = new Map<string, number | null>();

async function rateFromFrankfurter(currency: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(currency)}&symbols=USD`,
    );
    if (!response.ok) return null;
    const rate = Number((await response.json())?.rates?.USD);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

async function rateFromYahoo(currency: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${currency}USD=X`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; UnifiedMarket/1.0)" } },
    );
    if (!response.ok) return null;
    const price = Number((await response.json())?.chart?.result?.[0]?.meta?.regularMarketPrice);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

async function usdPerUnit(currency: string): Promise<number | null> {
  if (currency === "USD") return 1;
  if (fxCache.has(currency)) return fxCache.get(currency)!;

  let rate = await rateFromFrankfurter(currency);
  if (rate == null) {
    rate = await rateFromYahoo(currency);
    if (rate != null) console.log(`[update-market-caps] ${currency} rate via Yahoo fallback`);
  }
  if (rate == null) console.error(`[update-market-caps] no rate for ${currency}`);

  fxCache.set(currency, rate);
  return rate;
}

/** Market cap in dollars, or null when Finnhub has no usable profile. */
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

    // In the listing's own currency — and for an ADR, Finnhub resolves to the
    // foreign listing: asking for IX returns Tokyo-listed 8591.T with a cap of
    // 6,481,732, which is millions of YEN. Read as dollars that made ORIX a
    // $6.5 trillion company sitting above Nvidia at the top of the Top 100.
    // Converting rather than skipping keeps the real ADRs — TSM, ASML, SAP,
    // Novo — which are exactly the foreign names a US reader cares about.
    const { currency, divisor } = currencyForTicker(
      String(profile?.ticker ?? symbol),
      String(profile?.currency ?? "USD").toUpperCase(),
    );
    if (!currency) {
      console.warn(`[update-market-caps] unknown exchange for ${profile?.ticker}; skipping ${symbol}`);
      return null;
    }

    const rate = await usdPerUnit(currency);
    if (rate == null) {
      console.warn(`[update-market-caps] no ${currency} rate; skipping ${symbol}`);
      return null;
    }

    return (millions * 1_000_000 * rate) / divisor;
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

  // Diagnostic: return the provider's raw profile for one symbol. Guessing at
  // which field explains a wrong number is how bad data survives a fix.
  const probeBody = await req.json().catch(() => ({}));
  if (typeof probeBody?.probe === "string") {
    const key = nextFinnhubKey();
    const raw = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(probeBody.probe)}&token=${key}`,
    ).then((r) => r.json());
    return new Response(JSON.stringify(raw), {
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

    // The seed list goes first: it is what the rankings fall back to before
    // enough of the universe has a cap. Everything reporting earnings soon
    // follows, because that is what the calendar shows.
    const earningsSymbols = await upcomingEarningsSymbols(apiKey);
    const candidates = [...new Set([...TOP_100_SEED_SYMBOLS, ...earningsSymbols])];

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

    // Then the rest of the listed universe, so the rankings stop depending on a
    // hand-written list of what was big in 2023. Roughly 12,000 non-pink-sheet
    // symbols at 100 a run works through in about a day, after which each run
    // finds only what has gone stale.
    if (targets.length < BATCH_SIZE) {
      const { data, error } = await supabase
        .from("stocks")
        .select("symbol")
        .neq("exchange", "OOTC")
        .is("market_cap_updated_at", null)
        .limit(BATCH_SIZE - targets.length);

      if (error) console.error("[update-market-caps] universe query:", error.message);
      else {
        const already = new Set(targets.map((t) => t.symbol));
        for (const row of (data ?? []) as Target[]) {
          if (!already.has(row.symbol)) targets.push(row);
        }
      }
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

        // Stamp the timestamp even when Finnhub has no profile for the symbol.
        // Otherwise every ETF, warrant and delisted shell stays permanently
        // "never looked at", gets picked again every run, and the job never
        // advances past the first hundred of them.
        const { error } = await supabase
          .from("stocks")
          .update({
            ...(cap != null ? { market_cap: cap } : {}),
            market_cap_updated_at: new Date().toISOString(),
          })
          .eq("symbol", batch[j].symbol);

        if (error) console.error(`[update-market-caps] ${batch[j].symbol}:`, error.message);
        else if (cap != null) updated++;
        else missing++;
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
