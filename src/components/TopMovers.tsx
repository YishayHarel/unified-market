import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StockData {
  symbol: string;
  name: string;
  last_return_1d: number | null;
}

interface TopMoversProps {
  /** When true, hide internal title and use compact card styling for single-screen layout */
  compact?: boolean;
}

/**
 * TopMovers component - displays the top 3 stocks with biggest price movements
 * Uses smart fetching: only fetches prices for stocks that need display
 */
const TopMovers = ({ compact = false }: TopMoversProps) => {
  const navigate = useNavigate();
  const [topStocks, setTopStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch top movers from database (sorted by absolute return)
  useEffect(() => {
    const fetchTopMovers = async () => {
      try {
        // Get stocks with their last_return_1d, sorted by absolute value
        const { data, error } = await (supabase
          .from('stocks') as any)
          .select('symbol, name, last_return_1d')
          .eq('is_top_100', true)
          .not('last_return_1d', 'is', null)
          .order('last_return_1d', { ascending: false })
          .limit(50);

        if (error) throw error;

        if (data && data.length > 0) {
          // Sort by absolute value of return to get biggest movers (up or down)
          const sorted = [...data].sort((a, b) => 
            Math.abs(b.last_return_1d || 0) - Math.abs(a.last_return_1d || 0)
          );
          // Take top 3
          setTopStocks(sorted.slice(0, 3));
        } else {
          // No data available - show empty state
          setTopStocks([]);
        }
      } catch (error) {
        console.error('Error fetching top movers from DB:', error);
        // Don't show fake data - show empty state
        setTopStocks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTopMovers();
  }, []);

  const isLoading = loading;

  if (isLoading) {
    return (
      <section className={compact ? "flex-1 min-h-0 flex flex-col" : ""}>
        {!compact && <h2 className="text-2xl font-semibold mb-4">🚀 Top Movers</h2>}
        <div className={`grid grid-cols-3 gap-2 md:gap-3 ${compact ? "flex-1 min-h-0" : "gap-4"}`}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`bg-card rounded-lg animate-pulse ${compact ? "p-3" : "p-4"}`}>
              <div className={`flex items-center gap-2 ${compact ? "mb-2" : "gap-3 mb-3"}`}>
                <div className={`rounded-full bg-muted ${compact ? "w-6 h-6" : "w-8 h-8"}`}></div>
                <div className="space-y-1 flex-1 min-w-0">
                  <div className={`bg-muted rounded ${compact ? "h-3 w-12" : "h-4 w-16"}`}></div>
                  <div className={`bg-muted rounded ${compact ? "h-2.5 w-20" : "h-3 w-24"}`}></div>
                </div>
              </div>
              <div className={`flex justify-end ${compact ? "mt-1" : ""}`}>
                <div className={`bg-muted rounded ${compact ? "h-3 w-14" : "h-4 w-20"}`}></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (topStocks.length === 0) {
    return (
      <section className={compact ? "flex-1 min-h-0 flex flex-col" : ""}>
        {!compact && <h2 className="text-2xl font-semibold mb-4">🚀 Top Movers</h2>}
        <div className={`bg-card rounded-lg border border-border text-center ${compact ? "p-4 flex-1 flex flex-col justify-center" : "p-6"}`}>
          <AlertTriangle className={`text-muted-foreground mx-auto mb-2 ${compact ? "h-6 w-6" : "h-8 w-8 mb-3"}`} />
          <p className={`text-muted-foreground font-medium ${compact ? "text-sm" : ""}`}>Unable to load market movers</p>
          <p className={`text-muted-foreground mb-3 ${compact ? "text-xs" : "text-sm mb-4"}`}>Please try again later</p>
          <Button variant="outline" size={compact ? "sm" : "sm"} onClick={() => window.location.reload()} className={compact ? "text-xs" : ""}>
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Refresh
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={compact ? "flex-1 min-h-0 flex flex-col min-w-0" : ""}>
      {!compact && <h2 className="text-2xl font-semibold mb-4">🚀 Top Movers</h2>}
      <div className={`grid grid-cols-3 gap-2 md:gap-3 ${compact ? "flex-1 min-h-0 content-start" : "grid-cols-1 md:grid-cols-3 gap-4"}`}>
        {topStocks.map((stock) => {
          const changePercent = stock.last_return_1d ? stock.last_return_1d * 100 : 0;
          const positive = changePercent >= 0;

          return (
            <div
              key={stock.symbol}
              className={`backdrop-blur-sm rounded-xl border transition-colors cursor-pointer shadow-md ${compact ? "p-3 flex flex-col justify-between" : "p-4"} ${
                positive
                  ? "bg-emerald-400/95 border-emerald-300/70 hover:bg-emerald-400"
                  : "bg-red-900/80 border-red-700/50 hover:bg-red-800/90"
              }`}
              onClick={() => navigate(`/stock/${stock.symbol}`)}
            >
              <div className={`flex items-center gap-2 min-w-0 ${compact ? "mb-1.5" : "gap-3 mb-3"}`}>
                <div className={`rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 ${compact ? "w-6 h-6" : "w-8 h-8"}`}>
                  <span className={`font-bold text-white ${compact ? "text-xs" : "text-sm"}`}>{stock.symbol.charAt(0)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`font-bold tracking-wide truncate text-white ${compact ? "text-xs" : ""}`}>{stock.symbol}</div>
                  <div className={`text-white/80 truncate max-w-[18ch] ${compact ? "text-[10px]" : "text-sm"}`} title={stock.name}>
                    {stock.name}
                  </div>
                </div>
              </div>
              <div className={`flex justify-end items-center ${compact ? "mt-auto" : ""}`}>
                <div className={`font-semibold text-white ${compact ? "text-sm" : "text-lg"}`}>
                  {`${positive ? "+" : ""}${changePercent.toFixed(2)}%`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default TopMovers;
