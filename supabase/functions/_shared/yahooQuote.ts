/**
 * Daily quote and volume figures from Yahoo's chart endpoint.
 *
 * Keyless and unmetered, which is why it has displaced Twelve Data everywhere
 * these numbers are needed. Twelve Data's free tier allows 25 calls a day and
 * its key was not even configured, so the jobs that depended on it reported
 * success while returning nothing at all.
 *
 * Three separate jobs had grown their own copy of this fetch — the alert
 * checker, the ranking job and the smart-alert feed — and the copies had
 * already diverged on the one subtlety that matters (see previousClose below).
 */

export interface DailyQuote {
  symbol: string;
  price: number;
  /** Today's move as a percentage: 2.5 means +2.5%. */
  changePercent: number;
  /** Today's volume. */
  volume: number;
  /** Mean daily volume over the window, excluding today. */
  avgVolume: number;
}

/** Yahoo writes share classes with a dash where most providers use a dot. */
function yahooSymbol(symbol: string): string {
  return symbol.replace(".", "-");
}

export async function fetchDailyQuote(symbol: string): Promise<DailyQuote | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol))}` +
        `?range=3mo&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; UnifiedMarket/1.0)" } },
    );
    if (!response.ok) return null;

    const result = (await response.json())?.chart?.result?.[0];
    const meta = result?.meta;
    const quote = result?.indicators?.quote?.[0];

    const price = Number(meta?.regularMarketPrice);
    if (!Number.isFinite(price) || price <= 0) return null;

    // The previous close must come from the bars, not from meta. Over a 3mo
    // range chartPreviousClose is the close *before the window opened*, so
    // using it reports the three-month move as the day's — Tesla at -21% and
    // Microsoft at +20% on an ordinary session.
    const closes: number[] = (quote?.close ?? []).filter(
      (v: unknown) => typeof v === "number" && v > 0,
    ) as number[];
    const previous = closes.length >= 2 ? closes[closes.length - 2] : Number(meta?.previousClose);

    const changePercent =
      Number.isFinite(previous) && previous > 0 ? ((price - previous) / previous) * 100 : 0;

    const volumes: number[] = (quote?.volume ?? []).filter(
      (v: unknown) => typeof v === "number" && v > 0,
    ) as number[];

    // The last bar is today, which is the thing being compared rather than part
    // of the baseline it is compared against.
    const baseline = volumes.slice(0, -1);
    const avgVolume = baseline.length > 0
      ? Math.round(baseline.reduce((sum, v) => sum + v, 0) / baseline.length)
      : 0;

    return {
      symbol,
      price,
      changePercent,
      volume: Number(meta?.regularMarketVolume) || volumes[volumes.length - 1] || 0,
      avgVolume,
    };
  } catch (error) {
    console.error(`[yahooQuote] ${symbol}:`, (error as Error).message);
    return null;
  }
}

/** Fetches many symbols with bounded concurrency. Missing symbols are omitted. */
export async function fetchDailyQuotes(
  symbols: string[],
  concurrency = 8,
): Promise<Map<string, DailyQuote>> {
  const quotes = new Map<string, DailyQuote>();

  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = await Promise.all(
      symbols.slice(i, i + concurrency).map((symbol) => fetchDailyQuote(symbol)),
    );
    for (const quote of batch) {
      if (quote) quotes.set(quote.symbol, quote);
    }
  }

  return quotes;
}
