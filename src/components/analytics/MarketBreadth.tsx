import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, BarChart3 } from "lucide-react";

interface BreadthData {
  advancers: number;
  decliners: number;
  unchanged: number;
  above50MA: number;
  above200MA: number;
  newHighs: number;
  newLows: number;
  upVolume: number;
  downVolume: number;
}

const MarketBreadth = () => {
  const [breadth, setBreadth] = useState<BreadthData>({
    advancers: 0,
    decliners: 0,
    unchanged: 0,
    above50MA: 0,
    above200MA: 0,
    newHighs: 0,
    newLows: 0,
    upVolume: 0,
    downVolume: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate market breadth data
    const generateBreadthData = () => {
      const total = 500; // S&P 500 stocks
      const advancers = Math.floor(Math.random() * 300 + 100);
      const decliners = Math.floor(Math.random() * (total - advancers - 50));
      const unchanged = total - advancers - decliners;

      setBreadth({
        advancers,
        decliners,
        unchanged,
        above50MA: Math.floor(Math.random() * 40 + 30), // 30-70%
        above200MA: Math.floor(Math.random() * 30 + 40), // 40-70%
        newHighs: Math.floor(Math.random() * 30 + 5),
        newLows: Math.floor(Math.random() * 20 + 2),
        upVolume: Math.random() * 60 + 20, // 20-80%
        downVolume: 0, // Will be calculated
      });
      setLoading(false);
    };

    generateBreadthData();
    const interval = setInterval(generateBreadthData, 60000);
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

  const total = breadth.advancers + breadth.decliners + breadth.unchanged;
  const advanceDeclineRatio = breadth.decliners > 0 ? (breadth.advancers / breadth.decliners).toFixed(2) : "∞";
  const advancersPercent = (breadth.advancers / total) * 100;
  const isMarketBullish = breadth.advancers > breadth.decliners;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Market Breadth
          </CardTitle>
          <Badge variant={isMarketBullish ? "default" : "destructive"}>
            {isMarketBullish ? (
              <><TrendingUp className="h-3 w-3 mr-1" />Bullish</>
            ) : (
              <><TrendingDown className="h-3 w-3 mr-1" />Bearish</>
            )}
          </Badge>
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
              Ratio: {advanceDeclineRatio}
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
              style={{ width: `${(breadth.unchanged / total) * 100}%` }}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${(breadth.decliners / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Moving Average Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Above 50-Day MA</span>
              <span className="font-medium">{breadth.above50MA}%</span>
            </div>
            <Progress value={breadth.above50MA} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Above 200-Day MA</span>
              <span className="font-medium">{breadth.above200MA}%</span>
            </div>
            <Progress value={breadth.above200MA} className="h-2" />
          </div>
        </div>

        {/* New Highs/Lows */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-500">{breadth.newHighs}</div>
            <div className="text-xs text-muted-foreground">52-Week Highs</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-500">{breadth.newLows}</div>
            <div className="text-xs text-muted-foreground">52-Week Lows</div>
          </div>
        </div>

        {/* Volume Distribution */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Up Volume</span>
            <span className="font-medium">{breadth.upVolume.toFixed(1)}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex bg-muted">
            <div
              className="bg-green-500"
              style={{ width: `${breadth.upVolume}%` }}
            />
            <div
              className="bg-red-500"
              style={{ width: `${100 - breadth.upVolume}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Buying pressure</span>
            <span>Selling pressure</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketBreadth;
