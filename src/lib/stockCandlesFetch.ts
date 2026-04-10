import { supabase } from "@/integrations/supabase/client";
import { fetchStockCandlesFromBackend } from "@/lib/backendApi";

function hasUsableCandles(data: unknown, requireIndicators: boolean): boolean {
  const d = data as { candles?: unknown; indicators?: unknown } | null;
  const c = d?.candles;
  if (!Array.isArray(c) || c.length < 2) return false;
  if (requireIndicators && d?.indicators == null) return false;
  return true;
}

/**
 * Fetches OHLC candles for charts. Tries Supabase Edge first (where API secrets usually live in prod),
 * then the Express backend. Fixes the case where the backend returns 200 + empty candles and the
 * client never called the edge function.
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

  try {
    const bData = await fetchStockCandlesFromBackend({
      symbol: sym,
      period,
      includeIndicators: requireIndicators,
    });
    if (hasUsableCandles(bData, requireIndicators)) {
      return { data: bData, error: null };
    }
  } catch (e) {
    console.warn("[candles] Express backend:", e instanceof Error ? e.message : e);
  }

  if (!sErr && sData) {
    return { data: sData, error: null };
  }

  if (sErr) {
    return { data: null, error: { message: sErr.message || "get-stock-candles failed" } };
  }

  return { data: null, error: { message: "No chart data available" } };
}
