import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface StockMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  logo?: string;
}

const TopMovers = () => {
  const navigate = useNavigate();
  const [movers, setMovers] = useState<StockMover[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data for demonstration
  useEffect(() => {
    const mockMovers: StockMover[] = [
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        price: 175.43,
        change: 5.32,
        changePercent: 3.13,
      },
      {
        symbol: "TSLA",
        name: "Tesla Inc.",
        price: 248.87,
        change: -8.45,
        changePercent: -3.28,
      },
      {
        symbol: "NVDA",
        name: "NVIDIA Corporation",
        price: 432.15,
        change: 12.67,
        changePercent: 3.02,
      },
    ];

    setTimeout(() => {
      setMovers(mockMovers);
      setLoading(false);
    }, 1000);
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
                <div className="font-bold">${stock.price.toFixed(2)}</div>
                <div className={positive ? "text-green-400" : "text-red-400"}>
                  {positive ? "+" : ""}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
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