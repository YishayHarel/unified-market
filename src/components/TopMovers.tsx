import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStockPrices, StockPrice } from "@/hooks/useStockPrices";

interface StockData {
  symbol: string;
  name: string;
  last_return_1d: number | null;
}

/**
 * TopMovers component - displays the top 3 stocks with biggest price movements
 * Uses smart fetching: only fetches prices for stocks that need display
 */
const TopMovers = () => {
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
          // Fallback to some default symbols
          setTopStocks([
            { symbol: 'AAPL', name: 'Apple Inc.', last_return_1d: 0.02 },
            { symbol: 'MSFT', name: 'Microsoft Corporation', last_return_1d: 0.015 },
            { symbol: 'GOOGL', name: 'Alphabet Inc.', last_return_1d: -0.01 },
          ]);
        }
      } catch (error) {
        console.error('Error fetching top movers from DB:', error);
        setTopStocks([
          { symbol: 'AAPL', name: 'Apple Inc.', last_return_1d: 0.02 },
          { symbol: 'MSFT', name: 'Microsoft Corporation', last_return_1d: 0.015 },
          { symbol: 'GOOGL', name: 'Alphabet Inc.', last_return_1d: -0.01 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchTopMovers();
  }, []);

  // Only fetch prices for the 3 stocks we're displaying
  const symbolsToFetch = useMemo(() => topStocks.map(s => s.symbol), [topStocks]);
  const { prices, loading: pricesLoading } = useStockPrices(symbolsToFetch);

  const isLoading = loading || (topStocks.length > 0 && pricesLoading && prices.size === 0);

  if (isLoading) {
    return (
      <section>
        <h2 className="text-2xl font-semibold mb-4">🚀 Top Movers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card p-4 rounded-lg animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-muted"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-16"></div>
                  <div className="h-3 bg-muted rounded w-24"></div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="h-4 bg-muted rounded w-16"></div>
                <div className="h-4 bg-muted rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">🚀 Top Movers</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topStocks.map((stock) => {
          const priceData = prices.get(stock.symbol);
          const price = priceData?.price || 0;
          const changePercent = priceData?.changePercent ?? (stock.last_return_1d ? stock.last_return_1d * 100 : 0);
          const positive = changePercent >= 0;

          return (
            <div 
              key={stock.symbol} 
              className="bg-card p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer shadow-sm"
              onClick={() => navigate(`/stock/${stock.symbol}`)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-bold">{stock.symbol.charAt(0)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold tracking-wide">{stock.symbol}</div>
                  <div className="text-sm text-muted-foreground truncate max-w-[18ch]" title={stock.name}>
                    {stock.name}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="font-bold">
                  {price > 0 ? `$${price.toFixed(2)}` : '—'}
                </div>
                <div className={positive ? "text-primary" : "text-destructive"}>
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
