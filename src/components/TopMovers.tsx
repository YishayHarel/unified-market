import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface StockMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  logo?: string;
}

const TopMovers = () => {
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
      {
        symbol: "MSFT",
        name: "Microsoft Corporation",
        price: 378.92,
        change: -4.23,
        changePercent: -1.10,
      },
    ];

    setTimeout(() => {
      setMovers(mockMovers);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/50 border-accent/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Top Movers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">🚀 Top Movers</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {movers.map((stock) => {
          const positive = stock.change >= 0;
          return (
            <div key={stock.symbol} className="bg-card p-4 rounded-lg">
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