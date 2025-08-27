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
      // Get a sample of popular stocks from your database
      const { data: stocks, error: stocksError } = await supabase
        .from('stocks')
        .select('symbol, name')
        .in('symbol', ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'META', 'AMZN', 'NFLX'])
        .order('market_cap', { ascending: false });

      if (stocksError) {
        console.error('Error fetching stocks:', stocksError);
        throw stocksError;
      }

      if (stocks && stocks.length > 0) {
        // Get real-time prices for these stocks
        const symbols = stocks.map(stock => stock.symbol);
        console.log('Fetching prices for:', symbols);
        
        const { data: priceData, error: priceError } = await supabase.functions.invoke('get-stock-prices', {
          body: { symbols }
        });

        if (priceError) {
          console.error('Error fetching prices:', priceError);
          throw priceError;
        }

        if (priceData && priceData.length > 0) {
          const moversData = priceData
            .map((price: any) => {
              const stock = stocks.find(s => s.symbol === price.symbol);
              return stock ? {
                symbol: price.symbol,
                name: stock.name,
                price: price.price,
                change: price.change,
                changePercent: price.changePercent
              } : null;
            })
            .filter((mover: any) => mover !== null && mover.price > 0)
            .sort((a: any, b: any) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

          setMovers(moversData);
        } else {
          console.log('No price data returned, using fallback');
          // Fallback to some basic stock info if API fails
          setMovers(stocks.slice(0, 3).map(stock => ({
            symbol: stock.symbol,
            name: stock.name,
            price: 0,
            change: 0,
            changePercent: 0
          })));
        }
      }
    } catch (error) {
      console.error('Error fetching top movers:', error);
      // Fallback to basic display
      setMovers([
        { symbol: 'AAPL', name: 'Apple Inc.', price: 0, change: 0, changePercent: 0 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', price: 0, change: 0, changePercent: 0 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 0, change: 0, changePercent: 0 }
      ]);
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
                <div className="font-bold">
                  {stock.price > 0 ? `$${stock.price.toFixed(2)}` : 'Loading...'}
                </div>
                <div className={stock.change >= 0 ? "text-primary" : "text-destructive"}>
                  {stock.price > 0 ? (
                    `${stock.change >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%`
                  ) : (
                    'Updating...'
                  )}
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