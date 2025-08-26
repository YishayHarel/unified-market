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
    <Card className="bg-gradient-to-br from-card to-card/50 border-accent/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Top Movers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {movers.map((stock) => (
          <div
            key={stock.symbol}
            className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-background to-muted/20 hover:from-muted/30 hover:to-muted/40 transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {stock.symbol.charAt(0)}
                </span>
              </div>
              <div>
                <p className="font-semibold text-foreground">{stock.symbol}</p>
                <p className="text-sm text-muted-foreground truncate max-w-32">
                  {stock.name}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="font-semibold text-foreground">
                ${stock.price.toFixed(2)}
              </p>
              <div className="flex items-center gap-1">
                {stock.change >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-primary" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <Badge
                  variant={stock.change >= 0 ? "default" : "destructive"}
                  className="text-xs"
                >
                  {stock.change >= 0 ? "+" : ""}
                  {stock.changePercent.toFixed(2)}%
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default TopMovers;