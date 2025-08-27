import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StockMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

const TopMovers = () => {
  const navigate = useNavigate();
  const [movers, setMovers] = useState<StockMover[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTopMovers = async () => {
    try {
      // Get the actual top movers from the top 200 stocks by market cap
      // Using last_return_1d for daily percentage change
      const { data: stocks, error: stocksError } = await supabase
        .from('stocks')
        .select('symbol, name, last_return_1d, market_cap')
        .not('last_return_1d', 'is', null)
        .not('market_cap', 'is', null)
        .gte('market_cap', 1000000000) // At least 1B market cap
        .order('market_cap', { ascending: false })
        .limit(200);

      if (stocksError) {
        console.error('Error fetching stocks:', stocksError);
        throw stocksError;
      }

      if (stocks && stocks.length > 0) {
        // Sort by absolute percentage change to get the biggest movers (even small ones)
        const topMovers = stocks
          .filter(stock => stock.last_return_1d !== null)
          .sort((a, b) => Math.abs(b.last_return_1d) - Math.abs(a.last_return_1d))
          .slice(0, 3)
          .map(stock => ({
            symbol: stock.symbol,
            name: stock.name,
            price: 0, // We'll show percentage only since we don't have current prices
            change: 0, // We'll calculate this from percentage if needed
            changePercent: stock.last_return_1d * 100 // Convert from decimal to percentage
          }));

        console.log('Top movers found:', topMovers);
        setMovers(topMovers);
      } else {
        console.log('No stocks found with movement data');
        // Fallback if no data
        setMovers([]);
      }
    } catch (error) {
      console.error('Error fetching top movers:', error);
      // Fallback to empty array
      setMovers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopMovers();
  }, []);

  if (loading) {
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
      {movers.length === 0 ? (
        <div className="bg-card p-8 rounded-lg text-center">
          <p className="text-muted-foreground">No significant movers found in today's market</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {movers.map((stock) => {
            const positive = stock.change >= 0;
            return (
              <div 
                key={stock.symbol} 
                className="bg-card p-4 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
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
                  <div className="text-sm text-muted-foreground">
                    Daily Move
                  </div>
                  <div className={stock.changePercent >= 0 ? "text-primary" : "text-destructive"}>
                    {`${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default TopMovers;