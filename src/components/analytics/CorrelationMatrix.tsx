import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Info, RefreshCw, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface CorrelationData {
  symbols: string[];
  matrix: number[][];
}

// Calculate Pearson correlation coefficient
const calculateCorrelation = (x: number[], y: number[]): number => {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const xSlice = x.slice(0, n);
  const ySlice = y.slice(0, n);

  const sumX = xSlice.reduce((a, b) => a + b, 0);
  const sumY = ySlice.reduce((a, b) => a + b, 0);
  const sumXY = xSlice.reduce((acc, xi, i) => acc + xi * ySlice[i], 0);
  const sumX2 = xSlice.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = ySlice.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
};

// Calculate daily returns from prices
const calculateReturns = (prices: number[]): number[] => {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
};

const CorrelationMatrix = () => {
  const { user } = useAuth();
  const [data, setData] = useState<CorrelationData>({ symbols: [], matrix: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCorrelations = async () => {
    setLoading(true);
    setError(null);

    try {
      let symbols: string[] = [];

      // Get user's watchlist or use defaults
      if (user) {
        const { data: savedStocks } = await supabase
          .from("user_saved_stocks")
          .select("symbol")
          .eq("user_id", user.id)
          .limit(6);

        symbols = savedStocks?.map((s) => s.symbol) || [];
      }

      if (symbols.length < 2) {
        symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"];
      }

      // Fetch historical data for all symbols in parallel
      const pricePromises = symbols.map(async (symbol) => {
        try {
          const { data, error } = await supabase.functions.invoke('get-stock-candles', {
            body: { symbol, period: '3M' }
          });
          
          if (error || !data?.candles) {
            console.warn(`No candle data for ${symbol}`);
            return { symbol, prices: [] };
          }
          
          // Extract closing prices
          const prices = data.candles.map((c: any) => c.close);
          return { symbol, prices };
        } catch (err) {
          console.warn(`Error fetching ${symbol}:`, err);
          return { symbol, prices: [] };
        }
      });

      const priceData = await Promise.all(pricePromises);
      
      // Filter out symbols with insufficient data
      const validData = priceData.filter(d => d.prices.length >= 20);
      
      if (validData.length < 2) {
        throw new Error('Not enough historical data available');
      }

      const validSymbols = validData.map(d => d.symbol);
      
      // Calculate returns for each stock
      const returnsMap: { [key: string]: number[] } = {};
      validData.forEach(d => {
        returnsMap[d.symbol] = calculateReturns(d.prices);
      });

      // Build correlation matrix
      const matrix: number[][] = [];
      for (let i = 0; i < validSymbols.length; i++) {
        const row: number[] = [];
        for (let j = 0; j < validSymbols.length; j++) {
          if (i === j) {
            row.push(1);
          } else if (j < i) {
            row.push(matrix[j][i]); // Mirror
          } else {
            const corr = calculateCorrelation(
              returnsMap[validSymbols[i]],
              returnsMap[validSymbols[j]]
            );
            row.push(parseFloat(corr.toFixed(2)));
          }
        }
        matrix.push(row);
      }

      setData({ symbols: validSymbols, matrix });
    } catch (err) {
      console.error("Error calculating correlations:", err);
      setError(err instanceof Error ? err.message : 'Failed to calculate correlations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrelations();
  }, [user]);

  const getCellColor = (corr: number): string => {
    if (corr >= 0.8) return "bg-green-600 text-white";
    if (corr >= 0.5) return "bg-green-400 text-white";
    if (corr >= 0.2) return "bg-green-200 text-green-900";
    if (corr >= -0.2) return "bg-muted text-foreground";
    if (corr >= -0.5) return "bg-red-200 text-red-900";
    if (corr >= -0.8) return "bg-red-400 text-white";
    return "bg-red-600 text-white";
  };

  const getCorrelationLabel = (corr: number): string => {
    if (corr >= 0.8) return "Very High";
    if (corr >= 0.5) return "High";
    if (corr >= 0.2) return "Moderate";
    if (corr >= -0.2) return "Low";
    if (corr >= -0.5) return "Negative";
    return "Strong Negative";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 animate-pulse" />
            Correlation Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <div className="animate-pulse text-muted-foreground">Calculating correlations from historical data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Correlation Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-muted-foreground text-center text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchCorrelations}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (data.symbols.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Correlation Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          Add at least 2 stocks to your watchlist to see correlations.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Correlation Matrix
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-500 border-green-500">
              Live · 3M Data
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Calculated from 3-month historical returns.</p>
                  <p className="text-xs mt-1">Green = move together, Red = move opposite</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left"></th>
                {data.symbols.map((symbol) => (
                  <th key={symbol} className="p-2 text-center font-medium text-xs">
                    {symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.symbols.map((rowSymbol, i) => (
                <tr key={rowSymbol}>
                  <td className="p-2 font-medium text-xs">{rowSymbol}</td>
                  {data.matrix[i].map((corr, j) => (
                    <TooltipProvider key={`${i}-${j}`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td
                            className={`p-2 text-center text-xs cursor-default transition-transform hover:scale-110 ${getCellColor(corr)}`}
                          >
                            {corr.toFixed(2)}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{data.symbols[i]} ↔ {data.symbols[j]}</p>
                          <p className="text-xs">{getCorrelationLabel(corr)} correlation</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-1 mt-4 text-xs text-muted-foreground">
          <span>-1</span>
          <div className="flex gap-0.5">
            <div className="w-4 h-3 bg-red-600 rounded-sm" />
            <div className="w-4 h-3 bg-red-400 rounded-sm" />
            <div className="w-4 h-3 bg-red-200 rounded-sm" />
            <div className="w-4 h-3 bg-muted rounded-sm" />
            <div className="w-4 h-3 bg-green-200 rounded-sm" />
            <div className="w-4 h-3 bg-green-400 rounded-sm" />
            <div className="w-4 h-3 bg-green-600 rounded-sm" />
          </div>
          <span>+1</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default CorrelationMatrix;
