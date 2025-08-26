import { useState, useEffect } from "react";
import { DollarSign, Calendar, TrendingUp, PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface DividendStock {
  id: string;
  symbol: string;
  company: string;
  shares: number;
  dividendPerShare: number;
  frequency: "Monthly" | "Quarterly" | "Annually";
  nextPayDate: string;
  yield: number;
  totalAnnualDividend: number;
}

const DividendTracker = () => {
  const [dividendStocks, setDividendStocks] = useState<DividendStock[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data for demonstration
  useEffect(() => {
    const mockDividendStocks: DividendStock[] = [
      {
        id: "1",
        symbol: "AAPL",
        company: "Apple Inc.",
        shares: 100,
        dividendPerShare: 0.94,
        frequency: "Quarterly",
        nextPayDate: "2024-02-15",
        yield: 0.52,
        totalAnnualDividend: 376
      },
      {
        id: "2",
        symbol: "MSFT",
        company: "Microsoft Corporation",
        shares: 75,
        dividendPerShare: 3.00,
        frequency: "Quarterly",
        nextPayDate: "2024-03-14",
        yield: 0.73,
        totalAnnualDividend: 900
      },
      {
        id: "3",
        symbol: "JNJ",
        company: "Johnson & Johnson",
        shares: 50,
        dividendPerShare: 4.76,
        frequency: "Quarterly",
        nextPayDate: "2024-03-05",
        yield: 2.91,
        totalAnnualDividend: 952
      }
    ];

    setTimeout(() => {
      setDividendStocks(mockDividendStocks);
      setLoading(false);
    }, 1000);
  }, []);

  const totalAnnualDividends = dividendStocks.reduce((sum, stock) => sum + stock.totalAnnualDividend, 0);
  const averageYield = dividendStocks.length > 0 
    ? dividendStocks.reduce((sum, stock) => sum + stock.yield, 0) / dividendStocks.length 
    : 0;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric",
      year: "numeric"
    });
  };

  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case "Monthly": return "bg-primary text-primary-foreground";
      case "Quarterly": return "bg-accent text-accent-foreground";
      case "Annually": return "bg-secondary text-secondary-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/50 border-accent/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-primary" />
            Dividend Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border bg-muted/30">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border bg-muted/30">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-accent/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" />
          Dividend Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border bg-gradient-to-br from-primary/10 to-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Annual Dividends</span>
            </div>
            <p className="text-2xl font-bold text-primary">
              ${totalAnnualDividends.toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-gradient-to-br from-accent/10 to-accent/5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              <span className="text-sm text-muted-foreground">Avg Yield</span>
            </div>
            <p className="text-2xl font-bold text-accent">
              {averageYield.toFixed(2)}%
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-gradient-to-br from-secondary/10 to-secondary/5">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-secondary-foreground" />
              <span className="text-sm text-muted-foreground">Holdings</span>
            </div>
            <p className="text-2xl font-bold text-secondary-foreground">
              {dividendStocks.length}
            </p>
          </div>
        </div>

        {/* Dividend Stocks List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Your Dividend Stocks</h3>
          {dividendStocks.map((stock) => (
            <div
              key={stock.id}
              className="p-4 rounded-lg border bg-gradient-to-r from-background to-muted/20 hover:from-muted/30 hover:to-muted/40 transition-all duration-200"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {stock.symbol.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{stock.symbol}</p>
                    <p className="text-sm text-muted-foreground">{stock.company}</p>
                  </div>
                </div>
                <Badge className={getFrequencyColor(stock.frequency)}>
                  {stock.frequency}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Shares</p>
                  <p className="font-semibold text-foreground">{stock.shares}</p>
                </div>
                
                <div>
                  <p className="text-muted-foreground">Dividend/Share</p>
                  <p className="font-semibold text-foreground">
                    ${stock.dividendPerShare.toFixed(2)}
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground">Yield</p>
                  <p className="font-semibold text-primary">{stock.yield.toFixed(2)}%</p>
                </div>

                <div>
                  <p className="text-muted-foreground">Next Payment</p>
                  <p className="font-semibold text-foreground">
                    {formatDate(stock.nextPayDate)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Annual Dividend</span>
                  <span className="font-semibold text-primary">
                    ${stock.totalAnnualDividend.toLocaleString()}
                  </span>
                </div>
                <Progress 
                  value={(stock.totalAnnualDividend / totalAnnualDividends) * 100} 
                  className="h-2"
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DividendTracker;