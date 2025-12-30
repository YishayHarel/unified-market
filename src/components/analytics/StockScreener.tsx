import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, TrendingUp, TrendingDown, Search, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface ScreenerFilters {
  marketCapMin: string;
  marketCapMax: string;
  changeMin: string;
  changeMax: string;
  volumeMin: string;
  sector: string;
}

interface StockResult {
  symbol: string;
  name: string;
  market_cap: number | null;
  last_return_1d: number | null;
  avg_volume: number | null;
  rel_volume: number | null;
}

const SECTORS = [
  "All Sectors",
  "Technology",
  "Healthcare", 
  "Financials",
  "Consumer Discretionary",
  "Communication Services",
  "Industrials",
  "Consumer Staples",
  "Energy",
  "Utilities",
  "Real Estate",
  "Materials",
];

const formatMarketCap = (cap: number | null): string => {
  if (!cap) return "N/A";
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  return `$${cap.toLocaleString()}`;
};

const formatVolume = (vol: number | null): string => {
  if (!vol) return "N/A";
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
  return vol.toString();
};

const StockScreener = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ScreenerFilters>({
    marketCapMin: "",
    marketCapMax: "",
    changeMin: "",
    changeMax: "",
    volumeMin: "",
    sector: "All Sectors",
  });
  const [results, setResults] = useState<StockResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const runScreen = async () => {
    setLoading(true);
    setHasSearched(true);

    try {
      let query = supabase
        .from("stocks")
        .select("symbol, name, market_cap, last_return_1d, avg_volume, rel_volume")
        .order("market_cap", { ascending: false, nullsFirst: false })
        .limit(50);

      // Apply filters
      if (filters.marketCapMin) {
        const minCap = parseFloat(filters.marketCapMin) * 1e9; // Convert to billions
        query = query.gte("market_cap", minCap);
      }
      if (filters.marketCapMax) {
        const maxCap = parseFloat(filters.marketCapMax) * 1e9;
        query = query.lte("market_cap", maxCap);
      }
      if (filters.changeMin) {
        query = query.gte("last_return_1d", parseFloat(filters.changeMin));
      }
      if (filters.changeMax) {
        query = query.lte("last_return_1d", parseFloat(filters.changeMax));
      }
      if (filters.volumeMin) {
        const minVol = parseFloat(filters.volumeMin) * 1e6; // Convert to millions
        query = query.gte("avg_volume", minVol);
      }

      const { data, error } = await query;

      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error("Screener error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      marketCapMin: "",
      marketCapMax: "",
      changeMin: "",
      changeMax: "",
      volumeMin: "",
      sector: "All Sectors",
    });
    setResults([]);
    setHasSearched(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Stock Screener
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Market Cap Min (B)</label>
            <Input
              type="number"
              placeholder="e.g. 10"
              value={filters.marketCapMin}
              onChange={(e) => setFilters({ ...filters, marketCapMin: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Market Cap Max (B)</label>
            <Input
              type="number"
              placeholder="e.g. 500"
              value={filters.marketCapMax}
              onChange={(e) => setFilters({ ...filters, marketCapMax: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Change Min (%)</label>
            <Input
              type="number"
              placeholder="e.g. -5"
              value={filters.changeMin}
              onChange={(e) => setFilters({ ...filters, changeMin: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Change Max (%)</label>
            <Input
              type="number"
              placeholder="e.g. 10"
              value={filters.changeMax}
              onChange={(e) => setFilters({ ...filters, changeMax: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Volume Min (M)</label>
            <Input
              type="number"
              placeholder="e.g. 1"
              value={filters.volumeMin}
              onChange={(e) => setFilters({ ...filters, volumeMin: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Sector</label>
            <Select
              value={filters.sector}
              onValueChange={(value) => setFilters({ ...filters, sector: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTORS.map((sector) => (
                  <SelectItem key={sector} value={sector}>
                    {sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={runScreen} disabled={loading} className="flex-1">
            <Search className="h-4 w-4 mr-2" />
            {loading ? "Screening..." : "Run Screen"}
          </Button>
          <Button variant="outline" onClick={resetFilters}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        {/* Results */}
        {hasSearched && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {results.length} stocks found
              </span>
            </div>

            {results.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Symbol</th>
                        <th className="px-3 py-2 text-left font-medium">Name</th>
                        <th className="px-3 py-2 text-right font-medium">Market Cap</th>
                        <th className="px-3 py-2 text-right font-medium">Change</th>
                        <th className="px-3 py-2 text-right font-medium">Avg Volume</th>
                        <th className="px-3 py-2 text-right font-medium">Rel Vol</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {results.map((stock) => (
                        <tr
                          key={stock.symbol}
                          className="hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => navigate(`/stock/${stock.symbol}`)}
                        >
                          <td className="px-3 py-2 font-medium">{stock.symbol}</td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">
                            {stock.name}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatMarketCap(stock.market_cap)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={stock.last_return_1d && stock.last_return_1d >= 0 ? "text-green-500" : "text-red-500"}>
                              {stock.last_return_1d ? `${stock.last_return_1d >= 0 ? "+" : ""}${stock.last_return_1d.toFixed(2)}%` : "N/A"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatVolume(stock.avg_volume)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {stock.rel_volume ? (
                              <Badge variant={stock.rel_volume > 1.5 ? "default" : "secondary"}>
                                {stock.rel_volume.toFixed(2)}x
                              </Badge>
                            ) : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No stocks match your criteria. Try adjusting filters.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StockScreener;
