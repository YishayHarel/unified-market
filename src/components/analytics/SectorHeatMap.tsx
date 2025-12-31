import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStockPrices, clearPriceCache } from "@/hooks/useStockPrices";

interface SectorInfo {
  name: string;
  symbol: string;
}

const SECTORS: SectorInfo[] = [
  { name: "Technology", symbol: "XLK" },
  { name: "Healthcare", symbol: "XLV" },
  { name: "Financials", symbol: "XLF" },
  { name: "Consumer Disc.", symbol: "XLY" },
  { name: "Communication", symbol: "XLC" },
  { name: "Industrials", symbol: "XLI" },
  { name: "Consumer Staples", symbol: "XLP" },
  { name: "Energy", symbol: "XLE" },
  { name: "Utilities", symbol: "XLU" },
  { name: "Real Estate", symbol: "XLRE" },
  { name: "Materials", symbol: "XLB" },
];

const SectorHeatMap = () => {
  const symbols = useMemo(() => SECTORS.map(s => s.symbol), []);
  const { prices, loading, error, refresh } = useStockPrices(symbols);

  const sectors = useMemo(() => {
    return SECTORS.map(sector => {
      const priceData = prices.get(sector.symbol);
      return {
        ...sector,
        change: priceData?.changePercent ?? 0,
        price: priceData?.price ?? 0,
        isFallback: priceData?.isFallback ?? true,
      };
    });
  }, [prices]);

  const handleRefresh = () => {
    clearPriceCache();
    refresh();
  };

  const getHeatColor = (change: number): string => {
    // Extended range to +-5%
    if (change > 4) return "bg-green-700";
    if (change > 3) return "bg-green-600";
    if (change > 2) return "bg-green-500";
    if (change > 1) return "bg-green-400";
    if (change > 0) return "bg-green-300";
    if (change > -1) return "bg-red-300";
    if (change > -2) return "bg-red-400";
    if (change > -3) return "bg-red-500";
    if (change > -4) return "bg-red-600";
    return "bg-red-700";
  };

  const getTextColor = (change: number): string => {
    return Math.abs(change) > 0.5 ? "text-white" : "text-foreground";
  };

  if (loading && prices.size === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 animate-pulse" />
            Sector Heat Map
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading real-time sector data...</div>
        </CardContent>
      </Card>
    );
  }

  const sortedSectors = [...sectors].sort((a, b) => b.change - a.change);
  const topPerformer = sortedSectors[0];
  const worstPerformer = sortedSectors[sortedSectors.length - 1];
  const hasRealData = sectors.some(s => !s.isFallback && s.price > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sector Heat Map
            {hasRealData && (
              <Badge variant="outline" className="text-xs ml-2">Live</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Badge variant="outline" className="text-green-500 border-green-500/30">
              <TrendingUp className="h-3 w-3 mr-1" />
              {topPerformer.symbol} {topPerformer.change >= 0 ? '+' : ''}{topPerformer.change.toFixed(2)}%
            </Badge>
            <Badge variant="outline" className="text-red-500 border-red-500/30">
              <TrendingDown className="h-3 w-3 mr-1" />
              {worstPerformer.symbol} {worstPerformer.change.toFixed(2)}%
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {sectors.map((sector) => (
            <div
              key={sector.symbol}
              className={`${getHeatColor(sector.change)} ${getTextColor(sector.change)} rounded-lg p-3 transition-all hover:scale-105 cursor-pointer`}
            >
              <div className="font-bold text-sm truncate">{sector.name}</div>
              <div className="text-xs opacity-80">{sector.symbol}</div>
              <div className="text-lg font-bold mt-1">
                {sector.change >= 0 ? "+" : ""}{sector.change.toFixed(2)}%
              </div>
              {sector.price > 0 && (
                <div className="text-xs opacity-70">${sector.price.toFixed(2)}</div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-1 mt-4 text-xs text-muted-foreground">
          <span>-5%</span>
          <div className="flex gap-0.5">
            <div className="w-3 h-3 bg-red-700 rounded-sm" />
            <div className="w-3 h-3 bg-red-600 rounded-sm" />
            <div className="w-3 h-3 bg-red-500 rounded-sm" />
            <div className="w-3 h-3 bg-red-400 rounded-sm" />
            <div className="w-3 h-3 bg-red-300 rounded-sm" />
            <div className="w-3 h-3 bg-green-300 rounded-sm" />
            <div className="w-3 h-3 bg-green-400 rounded-sm" />
            <div className="w-3 h-3 bg-green-500 rounded-sm" />
            <div className="w-3 h-3 bg-green-600 rounded-sm" />
            <div className="w-3 h-3 bg-green-700 rounded-sm" />
          </div>
          <span>+5%</span>
        </div>

        {error && (
          <div className="text-center text-xs text-muted-foreground mt-2">
            Using cached data. {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SectorHeatMap;
