export interface BackendStockPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  isFallback?: boolean;
}

export interface BackendNewsArticle {
  title: string;
  description: string;
  source: { name: string };
  publishedAt: string;
  url: string;
  urlToImage?: string | null;
}

export interface BackendCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

const backendBaseUrl = import.meta.env.VITE_BACKEND_URL?.trim() || "http://localhost:4000";

/**
 * Every caller in this file falls back to a Supabase Edge Function when the
 * Express backend throws. Without a deadline that fallback never gets a chance:
 * a cold host (Render's free tier spins down after inactivity and takes ~20s to
 * wake) leaves the request hanging, so the user stares at a spinner instead of
 * being served by the edge path that was ready the whole time.
 *
 * Aborting early still opens the connection that triggers the wake-up, so the
 * backend warms in the background and later requests get to use it.
 */
const BACKEND_TIMEOUT_MS = 4000;

async function postToBackend<T>(
  path: string,
  body: unknown,
  timeoutMs: number = BACKEND_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${backendBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Backend ${path} failed: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (err) {
    // Surface aborts as a clear timeout so callers log something meaningful.
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Backend ${path} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchStockPricesFromBackend(symbols: string[]): Promise<BackendStockPrice[]> {
  const data = await postToBackend<unknown>("/api/stock-prices", { symbols });

  if (!Array.isArray(data)) {
    throw new Error("Backend stock-prices returned invalid response");
  }

  const prices = data as BackendStockPrice[];

  // A 200 carrying zeros is worse than an error: callers render $0.00 as if it
  // were the price. The backend reports this as isFallback when its upstream
  // gives it nothing — a stale provider key there produced a stock page showing
  // $0.00 for every field. Treat it as a failure so the caller falls through to
  // the edge function, which has its own key.
  const usable = prices.filter((p) => !p.isFallback && typeof p.price === "number" && p.price > 0);
  if (usable.length === 0 && prices.length > 0) {
    throw new Error("Backend stock-prices returned no usable prices");
  }

  return usable;
}

export async function fetchNewsFromBackend(payload: {
  symbol?: string;
  pageSize?: number;
}): Promise<{ articles: BackendNewsArticle[]; status: string }> {
  const data = await postToBackend<{ articles?: unknown; status: string }>(
    "/api/news",
    payload
  );

  if (!data || !Array.isArray(data.articles)) {
    throw new Error("Backend news returned invalid response");
  }

  return data as { articles: BackendNewsArticle[]; status: string };
}

export async function fetchStockCandlesFromBackend(payload: {
  symbol: string;
  period?: string;
  includeIndicators?: boolean;
}): Promise<{ candles: BackendCandle[] | null; indicators: any; error?: string }> {
  return postToBackend("/api/stock-candles", payload);
}

export async function fetchStockFundamentalsFromBackend(symbol: string): Promise<any> {
  return postToBackend("/api/stock-fundamentals", { symbol });
}

export async function fetchMarketSentimentFromBackend(): Promise<any> {
  return postToBackend("/api/market-sentiment", {});
}
