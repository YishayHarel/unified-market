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
  const [dividendStocks] = useState([
    {
      symbol: "AAPL",
      company: "Apple Inc.",
      shares: 100,
      dividendPerShare: 0.94,
      annualDividend: 376,
      yield: 0.52
    },
    {
      symbol: "MSFT",
      company: "Microsoft Corporation",
      shares: 75,
      dividendPerShare: 3.00,
      annualDividend: 900,
      yield: 0.73
    },
    {
      symbol: "JNJ",
      company: "Johnson & Johnson",
      shares: 50,
      dividendPerShare: 4.76,
      annualDividend: 952,
      yield: 2.91
    }
  ]);

  const totalAnnualDividends = dividendStocks.reduce((sum, stock) => sum + stock.annualDividend, 0);

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">💰 Dividend Tracker</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card p-4 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Total Annual</div>
          <div className="text-2xl font-bold text-primary">
            ${totalAnnualDividends.toLocaleString()}
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Holdings</div>
          <div className="text-2xl font-bold">{dividendStocks.length}</div>
        </div>
        
        <div className="bg-card p-4 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Monthly Est.</div>
          <div className="text-2xl font-bold text-accent">
            ${Math.round(totalAnnualDividends / 12).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {dividendStocks.map((stock) => (
          <div key={stock.symbol} className="bg-card p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-bold">{stock.symbol.charAt(0)}</span>
                </div>
                <div>
                  <div className="font-semibold">{stock.symbol}</div>
                  <div className="text-sm text-muted-foreground">{stock.company}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-primary">${stock.annualDividend}</div>
                <div className="text-sm text-muted-foreground">{stock.yield.toFixed(2)}% yield</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Shares: </span>
                <span className="font-medium">{stock.shares}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Div/Share: </span>
                <span className="font-medium">${stock.dividendPerShare.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default DividendTracker;