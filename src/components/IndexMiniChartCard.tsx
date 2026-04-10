import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { fetchStockCandlesFromBackend } from "@/lib/backendApi";
import type { StockPrice } from "@/hooks/useStockPrices";

interface IndexMiniChartCardProps {
  symbol: string;
  label: string;
  priceData?: StockPrice;
}

type Point = { i: number; close: number };

const IndexMiniChartCard = ({ symbol, label, priceData }: IndexMiniChartCardProps) => {
  const [series, setSeries] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCandles = useCallback(async () => {
    setLoading(true);
    try {
      let data: { candles?: { close: number; timestamp: number }[] } | null = null;
      try {
        const res = await fetchStockCandlesFromBackend({ symbol: symbol.toUpperCase(), period: "1W" });
        data = res as { candles?: { close: number; timestamp: number }[] };
      } catch {
        const fallback = await supabase.functions.invoke("get-stock-candles", {
          body: { symbol: symbol.toUpperCase(), period: "1W" },
        });
        data = fallback.data as { candles?: { close: number; timestamp: number }[] };
      }

      const candles = data?.candles;
      if (candles?.length) {
        setSeries(
          candles.map((c, i) => ({
            i,
            close: c.close,
          }))
        );
      } else {
        setSeries([]);
      }
    } catch (e) {
      console.warn("IndexMiniChartCard", symbol, e);
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  const positive = useMemo(() => {
    if (series.length < 2) return (priceData?.changePercent ?? 0) >= 0;
    const first = series[0].close;
    const last = series[series.length - 1].close;
    return last >= first;
  }, [series, priceData?.changePercent]);

  const stroke = positive ? "hsl(142, 71%, 45%)" : "hsl(0, 72%, 51%)";

  const displayPrice =
    priceData && priceData.price > 0
      ? priceData.price.toFixed(2)
      : series.length
        ? series[series.length - 1].close.toFixed(2)
        : "—";

  const changePct = priceData != null && typeof priceData.changePercent === "number" ? priceData.changePercent : null;
  const displayChange =
    changePct != null ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` : null;

  return (
    <div className="rounded-xl border border-border bg-card/80 p-3 min-w-0">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-xs font-mono text-muted-foreground">{symbol}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-semibold tabular-nums">${displayPrice}</div>
          {displayChange != null && changePct != null && (
            <div
              className={`text-xs font-medium tabular-nums ${
                changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {displayChange}
            </div>
          )}
        </div>
      </div>
      <div className="h-[56px] w-full">
        {loading ? (
          <div className="h-full w-full rounded bg-muted/50 animate-pulse" />
        ) : series.length < 2 ? (
          <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground">
            Chart n/a
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <YAxis domain={["dataMin", "dataMax"]} hide />
              <Area
                type="monotone"
                dataKey="close"
                stroke={stroke}
                fill={stroke}
                fillOpacity={0.12}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default IndexMiniChartCard;
