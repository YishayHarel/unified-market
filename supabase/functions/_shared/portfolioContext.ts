/**
 * Assembles what the AI functions need to know about one reader.
 *
 * The advisor previously queried holdings including avg_cost and current_price
 * and then passed only { symbol, shares, sector } into the prompt, so it could
 * not tell anyone whether they were up or down on a position. Everything the
 * model needs already existed in the database; none of it was reaching the
 * model.
 *
 * Arithmetic happens here rather than in the prompt: weights and P&L are
 * deterministic, and a model asked to divide will occasionally get it wrong.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface Position {
  symbol: string;
  companyName: string | null;
  sector: string;
  shares: number;
  avgCost: number;
  currentPrice: number | null;
  marketValue: number;
  weightPct: number;
  gainLossPct: number | null;
  gainLossAbs: number | null;
}

export interface RelatedHeadline {
  title: string;
  source: string;
  publishedAt: string;
  tickers: string[];
}

export interface PortfolioContext {
  positions: Position[];
  totalValue: number;
  totalCost: number;
  totalGainLossPct: number | null;
  sectorWeights: Array<{ sector: string; weightPct: number }>;
  largestPositionPct: number;
  watchlist: string[];
  headlines: RelatedHeadline[];
}

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const QUOTE_CONCURRENCY = 5;
const QUOTE_TIMEOUT_MS = 4000;

async function fetchQuote(symbol: string, key: string): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QUOTE_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`,
      { signal: controller.signal },
    );
    if (!res.ok) return null;
    const quote = await res.json() as { c?: number };
    // Finnhub answers 0 for unknown or delisted symbols.
    return typeof quote.c === "number" && quote.c > 0 ? quote.c : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Refreshes prices with bounded concurrency to respect Finnhub's rate limit. */
async function fetchQuotes(symbols: string[], key: string): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  let cursor = 0;

  async function worker() {
    while (cursor < symbols.length) {
      const symbol = symbols[cursor++];
      const price = await fetchQuote(symbol, key);
      if (price != null) prices.set(symbol, price);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(QUOTE_CONCURRENCY, symbols.length) }, worker),
  );
  return prices;
}

/**
 * Headlines mentioning the reader's symbols, from the ingest cache.
 *
 * This is what the ticker tagging was for: news about the reader's own
 * positions rather than the market at large.
 */
async function fetchRelatedHeadlines(
  supabase: SupabaseClient,
  symbols: string[],
  limit: number,
): Promise<RelatedHeadline[]> {
  if (symbols.length === 0) return [];

  const { data, error } = await supabase
    .from("news_articles")
    .select("title, source, published_at, tickers")
    .overlaps("tickers", symbols)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("Related headlines unavailable:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    title: row.title as string,
    source: row.source as string,
    publishedAt: row.published_at as string,
    tickers: (row.tickers as string[]) ?? [],
  }));
}

export async function loadPortfolioContext(
  supabase: SupabaseClient,
  userId: string,
  options: { refreshPrices?: boolean; headlineLimit?: number } = {},
): Promise<PortfolioContext> {
  const { refreshPrices = true, headlineLimit = 12 } = options;

  const [holdingsResult, savedResult] = await Promise.all([
    supabase
      .from("portfolio_holdings")
      .select("symbol, company_name, shares, avg_cost, current_price, sector")
      .eq("user_id", userId),
    supabase
      .from("user_saved_stocks")
      .select("symbol")
      .eq("user_id", userId)
      .limit(50),
  ]);

  const rawHoldings = holdingsResult.data ?? [];
  const watchlist = [...new Set((savedResult.data ?? []).map((r) => r.symbol as string))];

  // Stored current_price goes stale — the scheduled price refresh is not
  // reliable — so prefer a live quote and fall back to what is stored.
  let livePrices = new Map<string, number>();
  const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
  if (refreshPrices && finnhubKey && rawHoldings.length > 0) {
    livePrices = await fetchQuotes(
      [...new Set(rawHoldings.map((h) => h.symbol as string))],
      finnhubKey,
    );
  }

  const priced = rawHoldings.map((holding) => {
    const symbol = holding.symbol as string;
    const shares = Number(holding.shares) || 0;
    const avgCost = Number(holding.avg_cost) || 0;
    const currentPrice =
      livePrices.get(symbol) ??
      (holding.current_price != null ? Number(holding.current_price) : null);

    // Valuing at cost when no price is available keeps weights meaningful; the
    // null currentPrice still tells the model the figure is unverified.
    const marketValue = shares * (currentPrice ?? avgCost);

    return { holding, symbol, shares, avgCost, currentPrice, marketValue };
  });

  const totalValue = priced.reduce((sum, p) => sum + p.marketValue, 0);
  const totalCost = priced.reduce((sum, p) => sum + p.shares * p.avgCost, 0);

  const positions: Position[] = priced
    .map(({ holding, symbol, shares, avgCost, currentPrice, marketValue }) => ({
      symbol,
      companyName: (holding.company_name as string) ?? null,
      sector: (holding.sector as string) ?? "Unknown",
      shares,
      avgCost,
      currentPrice,
      marketValue,
      weightPct: totalValue > 0 ? (marketValue / totalValue) * 100 : 0,
      gainLossPct:
        currentPrice != null && avgCost > 0
          ? ((currentPrice - avgCost) / avgCost) * 100
          : null,
      gainLossAbs:
        currentPrice != null ? (currentPrice - avgCost) * shares : null,
    }))
    .sort((a, b) => b.weightPct - a.weightPct);

  const bySector = new Map<string, number>();
  for (const position of positions) {
    bySector.set(position.sector, (bySector.get(position.sector) ?? 0) + position.weightPct);
  }

  const symbols = [...new Set([...positions.map((p) => p.symbol), ...watchlist])];

  return {
    positions,
    totalValue,
    totalCost,
    totalGainLossPct:
      totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : null,
    sectorWeights: [...bySector.entries()]
      .map(([sector, weightPct]) => ({ sector, weightPct }))
      .sort((a, b) => b.weightPct - a.weightPct),
    largestPositionPct: positions[0]?.weightPct ?? 0,
    watchlist,
    headlines: await fetchRelatedHeadlines(supabase, symbols, headlineLimit),
  };
}

const money = (n: number) => `$${n.toFixed(2)}`;
const pct = (n: number | null) => (n == null ? "unknown" : `${n.toFixed(1)}%`);

/**
 * Renders the context as compact labelled text.
 *
 * Prose beats raw JSON here: it costs fewer tokens and models follow explicit
 * labels ("unrealised P&L") more reliably than they infer meaning from keys.
 */
export function formatPortfolioContext(context: PortfolioContext): string {
  if (context.positions.length === 0 && context.watchlist.length === 0) {
    return "The reader has no holdings and an empty watchlist.";
  }

  const lines: string[] = [];

  if (context.positions.length > 0) {
    lines.push(
      `PORTFOLIO — total value ${money(context.totalValue)}, ` +
        `cost basis ${money(context.totalCost)}, ` +
        `unrealised P&L ${pct(context.totalGainLossPct)}.`,
    );
    lines.push("Positions (largest first):");
    for (const p of context.positions) {
      const price = p.currentPrice == null
        ? "price unavailable"
        : `now ${money(p.currentPrice)}`;
      lines.push(
        `- ${p.symbol}${p.companyName ? ` (${p.companyName})` : ""}: ` +
          `${p.shares} shares, avg cost ${money(p.avgCost)}, ${price}, ` +
          `${pct(p.weightPct)} of portfolio, unrealised ${pct(p.gainLossPct)}` +
          `${p.gainLossAbs != null ? ` (${money(p.gainLossAbs)})` : ""}, ` +
          `sector ${p.sector}.`,
      );
    }

    lines.push(
      `Sector weights: ${
        context.sectorWeights.map((s) => `${s.sector} ${pct(s.weightPct)}`).join(", ")
      }.`,
    );
    lines.push(`Largest single position: ${pct(context.largestPositionPct)} of portfolio.`);
  }

  if (context.watchlist.length > 0) {
    lines.push(`Watchlist (not held): ${context.watchlist.join(", ")}.`);
  }

  if (context.headlines.length > 0) {
    lines.push("Recent headlines mentioning these symbols:");
    for (const h of context.headlines) {
      lines.push(
        `- [${h.tickers.join(",")}] ${h.title} (${h.source}, ${h.publishedAt.slice(0, 10)})`,
      );
    }
  } else {
    lines.push("No recent headlines matched these symbols.");
  }

  return lines.join("\n");
}
