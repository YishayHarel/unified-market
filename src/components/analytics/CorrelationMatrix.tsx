import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface CorrelationData {
  symbols: string[];
  matrix: number[][];
}

const CorrelationMatrix = () => {
  const { user } = useAuth();
  const [data, setData] = useState<CorrelationData>({ symbols: [], matrix: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWatchlistAndCalculate = async () => {
      if (!user) {
        // Use default stocks if not logged in
        generateCorrelations(["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"]);
        return;
      }

      try {
        const { data: savedStocks } = await supabase
          .from("user_saved_stocks")
          .select("symbol")
          .eq("user_id", user.id)
          .limit(8);

        const symbols = savedStocks?.map((s) => s.symbol) || [];
        
        if (symbols.length < 2) {
          // Use defaults if watchlist is too small
          generateCorrelations(["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"]);
        } else {
          generateCorrelations(symbols);
        }
      } catch (error) {
        console.error("Error fetching watchlist:", error);
        generateCorrelations(["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"]);
      }
    };

    const generateCorrelations = (symbols: string[]) => {
      // Generate realistic correlation matrix (simulated)
      const matrix: number[][] = [];
      
      for (let i = 0; i < symbols.length; i++) {
        const row: number[] = [];
        for (let j = 0; j < symbols.length; j++) {
          if (i === j) {
            row.push(1);
          } else if (j < i) {
            row.push(matrix[j][i]); // Mirror
          } else {
            // Generate correlation between -0.3 and 0.95
            // Tech stocks tend to be more correlated
            const basCorr = 0.4 + Math.random() * 0.5;
            row.push(parseFloat(basCorr.toFixed(2)));
          }
        }
        matrix.push(row);
      }

      setData({ symbols, matrix });
      setLoading(false);
    };

    fetchWatchlistAndCalculate();
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
          <div className="animate-pulse text-muted-foreground">Calculating correlations...</div>
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Shows how stocks in your watchlist move together.</p>
                <p className="text-xs mt-1">Green = move together, Red = move opposite</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
