import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface VolumeStock {
  symbol: string;
  name: string;
  relVolume: number;
  avgVolume: number;
  currentVolume: number;
  change: number;
}

const VolumeProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<VolumeStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVolumeData = async () => {
      try {
        // Get stocks with high relative volume
        const { data: stocksData } = await supabase
          .from("stocks")
          .select("symbol, name, rel_volume, avg_volume, last_return_1d")
          .not("rel_volume", "is", null)
          .order("rel_volume", { ascending: false })
          .limit(20);

        if (stocksData) {
          const volumeStocks: VolumeStock[] = stocksData.map((s) => ({
            symbol: s.symbol,
            name: s.name,
            relVolume: s.rel_volume || 1,
            avgVolume: s.avg_volume || 0,
            currentVolume: (s.avg_volume || 0) * (s.rel_volume || 1),
            change: s.last_return_1d || 0,
          }));
          setStocks(volumeStocks);
        }
      } catch (error) {
        console.error("Error fetching volume data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVolumeData();
    const interval = setInterval(fetchVolumeData, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const formatVolume = (vol: number): string => {
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
    return vol.toString();
  };

  const getVolumeColor = (relVol: number): string => {
    if (relVol >= 3) return "text-red-500";
    if (relVol >= 2) return "text-orange-500";
    if (relVol >= 1.5) return "text-yellow-500";
    return "text-muted-foreground";
  };

  const getVolumeBadge = (relVol: number) => {
    if (relVol >= 3) {
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Extreme</Badge>;
    }
    if (relVol >= 2) {
      return <Badge className="bg-orange-500 hover:bg-orange-600">High</Badge>;
    }
    if (relVol >= 1.5) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">Elevated</Badge>;
    }
    return <Badge variant="secondary">Normal</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 animate-pulse" />
            Volume Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <div className="animate-pulse text-muted-foreground">Loading volume data...</div>
        </CardContent>
      </Card>
    );
  }

  // Separate unusual volume stocks
  const unusualVolume = stocks.filter((s) => s.relVolume >= 1.5);
  const normalVolume = stocks.filter((s) => s.relVolume < 1.5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Volume Profile
          </CardTitle>
          <Badge variant="outline">
            {unusualVolume.length} unusual
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {unusualVolume.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Unusual Volume</h4>
            <div className="space-y-2">
              {unusualVolume.slice(0, 10).map((stock) => (
                <div
                  key={stock.symbol}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/stock/${stock.symbol}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12">
                      <div className="font-bold text-sm">{stock.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[80px]">
                        {stock.name}
                      </div>
                    </div>
                    {getVolumeBadge(stock.relVolume)}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getVolumeColor(stock.relVolume)}`}>
                        {stock.relVolume.toFixed(2)}x
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Rel. Volume
                      </div>
                    </div>

                    <div className="text-right min-w-[60px]">
                      <div className={`flex items-center justify-end ${stock.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {stock.change >= 0 ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatVolume(stock.currentVolume)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No unusual volume detected at this time.
          </div>
        )}

        {/* Volume bar visualization */}
        {unusualVolume.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-muted-foreground">Volume Distribution</h4>
            <div className="space-y-1">
              {unusualVolume.slice(0, 5).map((stock) => (
                <div key={stock.symbol} className="flex items-center gap-2">
                  <span className="text-xs w-12 text-right">{stock.symbol}</span>
                  <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        stock.relVolume >= 3 ? "bg-red-500" :
                        stock.relVolume >= 2 ? "bg-orange-500" : "bg-yellow-500"
                      }`}
                      style={{ width: `${Math.min(stock.relVolume / 5 * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs w-12">{stock.relVolume.toFixed(1)}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VolumeProfile;
