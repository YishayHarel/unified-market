import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface SectorData {
  name: string;
  symbol: string;
  change: number;
  volume: number;
}

const SECTORS: SectorData[] = [
  { name: "Technology", symbol: "XLK", change: 0, volume: 0 },
  { name: "Healthcare", symbol: "XLV", change: 0, volume: 0 },
  { name: "Financials", symbol: "XLF", change: 0, volume: 0 },
  { name: "Consumer Disc.", symbol: "XLY", change: 0, volume: 0 },
  { name: "Communication", symbol: "XLC", change: 0, volume: 0 },
  { name: "Industrials", symbol: "XLI", change: 0, volume: 0 },
  { name: "Consumer Staples", symbol: "XLP", change: 0, volume: 0 },
  { name: "Energy", symbol: "XLE", change: 0, volume: 0 },
  { name: "Utilities", symbol: "XLU", change: 0, volume: 0 },
  { name: "Real Estate", symbol: "XLRE", change: 0, volume: 0 },
  { name: "Materials", symbol: "XLB", change: 0, volume: 0 },
];

const SectorHeatMap = () => {
  const [sectors, setSectors] = useState<SectorData[]>(SECTORS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate sector data with realistic variations
    const generateSectorData = () => {
      const updated = SECTORS.map((sector) => ({
        ...sector,
        change: (Math.random() - 0.5) * 6, // -3% to +3%
        volume: Math.random() * 100 + 50, // 50M to 150M
      }));
      setSectors(updated);
      setLoading(false);
    };

    generateSectorData();
    const interval = setInterval(generateSectorData, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  const getHeatColor = (change: number): string => {
    if (change > 2) return "bg-green-600";
    if (change > 1) return "bg-green-500";
    if (change > 0.5) return "bg-green-400";
    if (change > 0) return "bg-green-300";
    if (change > -0.5) return "bg-red-300";
    if (change > -1) return "bg-red-400";
    if (change > -2) return "bg-red-500";
    return "bg-red-600";
  };

  const getTextColor = (change: number): string => {
    return Math.abs(change) > 1 ? "text-white" : "text-foreground";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 animate-pulse" />
            Sector Heat Map
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading sectors...</div>
        </CardContent>
      </Card>
    );
  }

  const sortedSectors = [...sectors].sort((a, b) => b.change - a.change);
  const topPerformer = sortedSectors[0];
  const worstPerformer = sortedSectors[sortedSectors.length - 1];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sector Heat Map
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-green-500 border-green-500/30">
              <TrendingUp className="h-3 w-3 mr-1" />
              {topPerformer.symbol} +{topPerformer.change.toFixed(2)}%
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
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-1 mt-4 text-xs text-muted-foreground">
          <span>-3%</span>
          <div className="flex gap-0.5">
            <div className="w-4 h-3 bg-red-600 rounded-sm" />
            <div className="w-4 h-3 bg-red-500 rounded-sm" />
            <div className="w-4 h-3 bg-red-400 rounded-sm" />
            <div className="w-4 h-3 bg-red-300 rounded-sm" />
            <div className="w-4 h-3 bg-green-300 rounded-sm" />
            <div className="w-4 h-3 bg-green-400 rounded-sm" />
            <div className="w-4 h-3 bg-green-500 rounded-sm" />
            <div className="w-4 h-3 bg-green-600 rounded-sm" />
          </div>
          <span>+3%</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default SectorHeatMap;
