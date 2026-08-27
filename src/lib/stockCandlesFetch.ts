import { supabase } from "@/integrations/supabase/client";

function hasUsableCandles(data: unknown, requireIndicators: boolean): boolean {
  const d = data as { candles?: unknown; indicators?: unknown } | null;
  const c = d?.candles;
  if (!Array.isArray(c) || c.length < 2) return false;
  if (requireIndicators && d?.indicators == null) return false;
  return true;
}

/**
 * Fetches OHLC candles for charts from the edge function, which sources Yahoo
 * first and falls back through the keyed providers internally.
 */
export async function fetchStockCandlesReliable(payload: {
  symbol: string;
  period: string;
  includeIndicators?: boolean;
}): Promise<{ data: any; error: { message: string } | null }> {
  const sym = payload.symbol.toUpperCase();
  const period = payload.period;
  const requireIndicators = Boolean(payload.includeIndicators);
  const body: Record<string, unknown> = { symbol: sym, period };
  if (payload.includeIndicators !== undefined) {
    body.includeIndicators = payload.includeIndicators;
  }

  const { data: sData, error: sErr } = await supabase.functions.invoke("get-stock-candles", { body });

  if (!sErr && hasUsableCandles(sData, requireIndicators)) {
    return { data: sData, error: null };
  }
  if (sErr) {
    console.warn("[candles] get-stock-candles:", sErr.message);
  }

  if (!sErr && sData) {
    return { data: sData, error: null };
  }

  if (sErr) {
    return { data: null, error: { message: sErr.message || "get-stock-candles failed" } };
  }

  return { data: null, error: { message: "No chart data available" } };
}
