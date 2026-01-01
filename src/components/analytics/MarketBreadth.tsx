import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, BarChart3, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface BreadthData {
  advancers: number;
  decliners: number;
  unchanged: number;
  totalStocks: number;
  avgGain: number;
  avgLoss: number;
  biggestGainer: { symbol: string; change: number } | null;
  biggestLoser: { symbol: string; change: number } | null;
}

const MarketBreadth = () => {
  const [breadth, setBreadth] = useState<BreadthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBreadthData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch top 100 stocks with their daily returns
      const { data: stocks, error: dbError } = await supabase
        .from('stocks')
        .select('symbol, name, last_return_1d, is_top_100')
        .eq('is_top_100', true)
        .not('last_return_1d', 'is', null);

      if (dbError) throw dbError;

      if (!stocks || stocks.length === 0) {
        throw new Error('No stock data available');
      }

      // Calculate breadth metrics
      let advancers = 0;
      let decliners = 0;
      let unchanged = 0;
      let totalGains = 0;
      let totalLosses = 0;
      let gainCount = 0;
      let lossCount = 0;
      let biggestGainer: { symbol: string; change: number } | null = null;
      let biggestLoser: { symbol: string; change: number } | null = null;

      stocks.forEach((stock) => {
        const change = stock.last_return_1d || 0;
        
        if (change > 0.001) {
          advancers++;
          totalGains += change;
          gainCount++;
          if (!biggestGainer || change > biggestGainer.change) {
            biggestGainer = { symbol: stock.symbol, change };
          }
        } else if (change < -0.001) {
          decliners++;
          totalLosses += Math.abs(change);
          lossCount++;
          if (!biggestLoser || change < biggestLoser.change) {
            biggestLoser = { symbol: stock.symbol, change };
          }
        } else {
          unchanged++;
        }
      });

      setBreadth({
        advancers,
        decliners,
        unchanged,
        totalStocks: stocks.length,
        avgGain: gainCount > 0 ? (totalGains / gainCount) * 100 : 0,
        avgLoss: lossCount > 0 ? (totalLosses / lossCount) * 100 : 0,
        biggestGainer,
        biggestLoser,
      });
    } catch (err) {
      console.error('Error fetching market breadth:', err);
      setError(err instanceof Error ? err.message : 'Failed to load market breadth');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBreadthData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchBreadthData, 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 animate-pulse" />
            Market Breadth
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <div className="animate-pulse text-muted-foreground">Loading breadth data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !breadth) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Market Breadth
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-muted-foreground text-center">{error || 'Unable to load data'}</p>
          <Button variant="outline" size="sm" onClick={fetchBreadthData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const total = breadth.advancers + breadth.decliners + breadth.unchanged;
  const advanceDeclineRatio = breadth.decliners > 0 ? (breadth.advancers / breadth.decliners).toFixed(2) : "∞";
  const advancersPercent = total > 0 ? (breadth.advancers / total) * 100 : 0;
  const isMarketBullish = breadth.advancers > breadth.decliners;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Market Breadth
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-500 border-green-500">
              Live · Top {breadth.totalStocks}
            </Badge>
            <Badge variant={isMarketBullish ? "default" : "destructive"}>
              {isMarketBullish ? (
                <><TrendingUp className="h-3 w-3 mr-1" />Bullish</>
              ) : (
                <><TrendingDown className="h-3 w-3 mr-1" />Bearish</>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Advance/Decline Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-green-500 font-medium">
              Advancers: {breadth.advancers}
            </span>
            <span className="text-muted-foreground">
              A/D Ratio: {advanceDeclineRatio}
            </span>
            <span className="text-red-500 font-medium">
              Decliners: {breadth.decliners}
            </span>
          </div>
          <div className="h-4 rounded-full overflow-hidden flex bg-muted">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${advancersPercent}%` }}
            />
            <div
              className="bg-muted-foreground/30"
              style={{ width: `${total > 0 ? (breadth.unchanged / total) * 100 : 0}%` }}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${total > 0 ? (breadth.decliners / total) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Average Gains/Losses */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg Gain</span>
              <span className="font-medium text-green-500">+{breadth.avgGain.toFixed(2)}%</span>
            </div>
            <Progress value={Math.min(breadth.avgGain * 10, 100)} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg Loss</span>
              <span className="font-medium text-red-500">-{breadth.avgLoss.toFixed(2)}%</span>
            </div>
            <Progress value={Math.min(breadth.avgLoss * 10, 100)} className="h-2" />
          </div>
        </div>

        {/* Top Movers */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            {breadth.biggestGainer ? (
              <>
                <div className="text-lg font-bold text-green-500">{breadth.biggestGainer.symbol}</div>
                <div className="text-sm text-green-500">+{(breadth.biggestGainer.change * 100).toFixed(2)}%</div>
                <div className="text-xs text-muted-foreground">Top Gainer</div>
              </>
            ) : (
              <div className="text-muted-foreground text-sm">No gainers</div>
            )}
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            {breadth.biggestLoser ? (
              <>
                <div className="text-lg font-bold text-red-500">{breadth.biggestLoser.symbol}</div>
                <div className="text-sm text-red-500">{(breadth.biggestLoser.change * 100).toFixed(2)}%</div>
                <div className="text-xs text-muted-foreground">Top Loser</div>
              </>
            ) : (
              <div className="text-muted-foreground text-sm">No losers</div>
            )}
          </div>
        </div>

        {/* Unchanged count */}
        {breadth.unchanged > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            {breadth.unchanged} stocks unchanged
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MarketBreadth;
