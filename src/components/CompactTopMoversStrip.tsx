import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface StockData {
  symbol: string;
  last_return_1d: number | null;
}

const CompactTopMoversStrip = () => {
  const navigate = useNavigate();
  const [movers, setMovers] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const fetchMovers = async () => {
      try {
        const { data, error } = await (supabase.from("stocks") as any)
          .select("symbol, last_return_1d")
          .eq("is_top_100", true)
          .not("last_return_1d", "is", null)
          .order("last_return_1d", { ascending: false })
          .limit(80);

        if (error) throw error;

        if (data?.length) {
          const sorted = [...data].sort(
            (a, b) => Math.abs(b.last_return_1d || 0) - Math.abs(a.last_return_1d || 0)
          );
          setMovers(sorted.slice(0, 20));
        } else {
          setMovers([]);
        }
      } catch (e) {
        console.error("CompactTopMoversStrip:", e);
        setMovers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMovers();
  }, []);

  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="h-9 min-w-[88px] rounded-full bg-muted animate-pulse flex-shrink-0"
          />
        ))}
      </div>
    );
  }

  if (movers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-2">No mover data right now</p>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Top movers today</h3>
      {/* The row scrolls past the edge with nothing to show it. A fade on the
          right reads as "there is more", where a cut-off pill reads as a layout
          bug; it is masked out once the row is scrolled to the end. */}
      <div className="relative">
        <div
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
          }}
        >
        {movers.map((stock) => {
          const pct = stock.last_return_1d != null ? stock.last_return_1d * 100 : 0;
          const up = pct >= 0;
          return (
            <button
              key={stock.symbol}
              type="button"
              onClick={() => navigate(`/stock/${stock.symbol}`)}
              className={cn(
                "flex-shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                "hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
                up
                  ? "border-emerald-600/70 text-emerald-600 dark:text-emerald-400 dark:border-emerald-500/60 bg-emerald-500/5"
                  : "border-red-600/70 text-red-600 dark:text-red-400 dark:border-red-500/60 bg-red-500/5"
              )}
            >
              <span className="tabular-nums">{stock.symbol}</span>
              <span className="ml-1.5 tabular-nums">
                {up ? "+" : ""}
                {pct.toFixed(2)}%
              </span>
            </button>
          );
        })}
        </div>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent transition-opacity",
            atEnd ? "opacity-0" : "opacity-100",
          )}
        />
      </div>
    </div>
  );
};

export default CompactTopMoversStrip;
