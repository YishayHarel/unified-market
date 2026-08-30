// Dividend facts for a single symbol.
//
// The dividend tracker used to make people type the payout themselves: symbol,
// company, dividend per share, how many times a year, and the yield. Nobody
// knows their holdings' dividend per share off the top of their head, so the
// numbers that got entered were guesses, and they went stale the moment a
// company raised its payout. A tracker whose inputs are wrong tracks nothing.
//
// Yahoo's chart endpoint returns the actual dividend history alongside the
// current price, with no key and no quota, which is the same source the candle
// charts already use. From that history the payout, the cadence, the yield and
// the next expected payment all follow.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIdentifier,
  RATE_LIMIT_TIERS,
} from "../_shared/rate-limit.ts";

interface Payment {
  date: string;
  amount: number;
}

export interface DividendInfo {
  symbol: string;
  company: string | null;
  price: number | null;
  currency: string | null;
  /** Most recent single payment, not the annual total. */
  dividendPerShare: number | null;
  /** Payments per year, inferred from the spacing of the last two years. */
  frequency: number | null;
  annualDividend: number | null;
  yieldPercentage: number | null;
  lastPaidDate: string | null;
  /** Estimated, by adding the average gap to the last payment. */
  nextPayDate: string | null;
  payments: Payment[];
  paysDividend: boolean;
}

// Dividend history changes a few times a year; the price moves all day. Six
// hours keeps the payout fresh without turning a form field into a quote feed.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { data: DividendInfo; expiry: number }>();

const DAY_MS = 24 * 60 * 60 * 1000;

/** Frequencies a listed company actually uses, with the gap in days each implies. */
const CADENCES: Array<{ frequency: number; days: number }> = [
  { frequency: 12, days: 30 },
  { frequency: 4, days: 91 },
  { frequency: 2, days: 182 },
  { frequency: 1, days: 365 },
];

/**
 * Infers payments per year from the spacing between them.
 *
 * Counting last year's payments would be wrong for anything that started or
 * changed schedule mid-year, and for a company that shifted a payment across a
 * year boundary. The median gap is unaffected by both.
 */
function inferFrequency(payments: Payment[]): number | null {
  if (payments.length < 2) return null;

  const gaps: number[] = [];
  for (let i = 1; i < payments.length; i++) {
    const gap = Date.parse(payments[i].date) - Date.parse(payments[i - 1].date);
    if (gap > 0) gaps.push(gap / DAY_MS);
  }
  if (gaps.length === 0) return null;

  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];

  let best = CADENCES[0];
  for (const cadence of CADENCES) {
    if (Math.abs(cadence.days - median) < Math.abs(best.days - median)) best = cadence;
  }
  return best.frequency;
}

/** The next payment, assuming the company keeps to the cadence it has been using. */
function estimateNextPayDate(payments: Payment[], frequency: number | null): string | null {
  if (payments.length === 0 || !frequency) return null;

  const last = payments[payments.length - 1];
  const cadence = CADENCES.find((c) => c.frequency === frequency);
  if (!cadence) return null;

  let next = Date.parse(last.date) + cadence.days * DAY_MS;
  // A symbol nobody has looked at in a while can have a stale last payment;
  // roll forward until the estimate is in the future rather than reporting a
  // date that has already passed.
  const now = Date.now();
  let guard = 0;
  while (next < now && guard++ < 24) next += cadence.days * DAY_MS;

  return new Date(next).toISOString().slice(0, 10);
}

async function fetchDividendInfo(symbol: string): Promise<DividendInfo> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&range=2y&events=div`;

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; UnifiedMarket/1.0)" },
  });

  if (!response.ok) {
    throw new Error(`Yahoo returned ${response.status} for ${symbol}`);
  }

  const json = await response.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No data for ${symbol}`);
  }

  const meta = result.meta ?? {};
  const rawEvents = result.events?.dividends ?? {};

  const payments: Payment[] = Object.values(rawEvents)
    .map((event: any) => ({
      date: new Date(Number(event.date) * 1000).toISOString().slice(0, 10),
      amount: Number(event.amount),
    }))
    .filter((p) => Number.isFinite(p.amount) && p.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const price = Number.isFinite(meta.regularMarketPrice) ? Number(meta.regularMarketPrice) : null;
  const latest = payments.length > 0 ? payments[payments.length - 1] : null;
  const frequency = inferFrequency(payments);

  // Prefer the declared rate over summing history: a company that raised its
  // payout last quarter should show the new annual rate, not a blend of old
  // and new payments.
  const annualDividend = latest && frequency ? Number((latest.amount * frequency).toFixed(4)) : null;

  const yieldPercentage =
    annualDividend && price && price > 0
      ? Number(((annualDividend / price) * 100).toFixed(2))
      : null;

  return {
    symbol: symbol.toUpperCase(),
    company: meta.longName ?? meta.shortName ?? null,
    price,
    currency: meta.currency ?? null,
    dividendPerShare: latest?.amount ?? null,
    frequency,
    annualDividend,
    yieldPercentage,
    lastPaidDate: latest?.date ?? null,
    nextPayDate: estimateNextPayDate(payments, frequency),
    // Newest first reads better anywhere this is shown.
    payments: [...payments].reverse().slice(0, 12),
    paysDividend: payments.length > 0,
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const rateCheck = checkRateLimit(`dividend-info:${getClientIdentifier(req)}`, RATE_LIMIT_TIERS.data);
  if (!rateCheck.allowed) {
    return createRateLimitResponse(rateCheck, corsHeaders);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const raw = typeof body.symbol === "string" ? body.symbol : "";
    const symbol = raw.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);

    if (!symbol) {
      return new Response(JSON.stringify({ error: "symbol is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cached = cache.get(symbol);
    if (cached && Date.now() < cached.expiry) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const info = await fetchDividendInfo(symbol);
    cache.set(symbol, { data: info, expiry: Date.now() + CACHE_TTL_MS });

    return new Response(JSON.stringify(info), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[get-dividend-info]", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
