import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Activity, BarChart3, AlertTriangle } from "lucide-react";

interface MarketSentiment {
  fearGreedIndex: {
    score: number;
    label: string;
    vixLevel: number;
  };
  marketMomentum: {
    spyChange: string;
    spyPrice: number;
    direction: string;
  };
  newsSentiment: {
    overall: string;
    analysisNote: string;
  };
  marketHealthScore: {
    score: number;
    label: string;
  };
  sectorRotation: {
    leaders: Array<{ sector: string; change: number; price: number }>;
    laggards: Array<{ sector: string; change: number; price: number }>;
  };
  indicators: {
    vix: {
      level: number;
      change: number;
      interpretation: string;
    };
  };
  timestamp: string;
}

const MarketSentimentDashboard = () => {
  const [sentimentData, setSentimentData] = useState<MarketSentiment | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchMarketSentiment();
    // Refresh every 5 minutes
    const interval = setInterval(fetchMarketSentiment, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchMarketSentiment = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('market-sentiment', {
        body: {}
      });

      if (error) throw error;
      setSentimentData(data);
    } catch (error) {
      console.error('Error fetching market sentiment:', error);
      toast({
        title: "Error",
        description: "Failed to fetch market sentiment data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFearGreedColor = (score: number) => {
    if (score >= 75) return "text-green-600";
    if (score >= 55) return "text-green-400";
    if (score >= 45) return "text-yellow-500";
    if (score >= 25) return "text-orange-500";
    return "text-red-500";
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? "text-green-500" : "text-red-500";
  };

  const getChangeIcon = (change: number) => {
    return change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  const getSentimentBadgeVariant = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive':
        return 'default';
      case 'negative':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading market sentiment...</p>
        </CardContent>
      </Card>
    );
  }

  if (!sentimentData) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Unable to load market sentiment data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Market Sentiment Dashboard
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(sentimentData.timestamp).toLocaleTimeString()}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Fear & Greed Index */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-center space-y-2">
                  <h3 className="font-semibold">Fear & Greed Index</h3>
                  <div className={`text-3xl font-bold ${getFearGreedColor(sentimentData.fearGreedIndex.score)}`}>
                    {sentimentData.fearGreedIndex.score}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {sentimentData.fearGreedIndex.label}
                  </div>
                  <Progress 
                    value={sentimentData.fearGreedIndex.score} 
                    className="w-full" 
                  />
                  <div className="text-xs text-muted-foreground">
                    VIX Level: {sentimentData.fearGreedIndex.vixLevel.toFixed(2)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Market Health */}
            <Card>
              <CardContent className="p-4">
                <div className="text-center space-y-2">
                  <h3 className="font-semibold">Market Health</h3>
                  <div className="text-3xl font-bold text-blue-600">
                    {sentimentData.marketHealthScore.score}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {sentimentData.marketHealthScore.label}
                  </div>
                  <Progress 
                    value={sentimentData.marketHealthScore.score} 
                    className="w-full" 
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Market Momentum & News Sentiment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">SPY Momentum</h3>
                    <div className={`flex items-center gap-2 ${getChangeColor(parseFloat(sentimentData.marketMomentum.spyChange))}`}>
                      {getChangeIcon(parseFloat(sentimentData.marketMomentum.spyChange))}
                      <span className="font-semibold">
                        {sentimentData.marketMomentum.spyChange}%
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ${sentimentData.marketMomentum.spyPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">News Sentiment</h3>
                  <Badge variant={getSentimentBadgeVariant(sentimentData.newsSentiment.overall)}>
                    {sentimentData.newsSentiment.overall}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {sentimentData.newsSentiment.analysisNote}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* VIX Analysis */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Volatility Analysis (VIX)</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold">
                      {sentimentData.indicators.vix.level.toFixed(2)}
                    </div>
                    <div className={`flex items-center gap-1 ${getChangeColor(sentimentData.indicators.vix.change)}`}>
                      {getChangeIcon(sentimentData.indicators.vix.change)}
                      <span>{sentimentData.indicators.vix.change.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {sentimentData.indicators.vix.interpretation}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sector Rotation */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4">Sector Rotation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-green-600 mb-2">Top Performers</h4>
                  <div className="space-y-2">
                    {sentimentData.sectorRotation.leaders.map((sector, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm">{sector.sector}</span>
                        <div className="flex items-center gap-1 text-green-500">
                          <TrendingUp className="h-3 w-3" />
                          <span className="text-sm font-medium">
                            {sector.change.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-red-600 mb-2">Laggards</h4>
                  <div className="space-y-2">
                    {sentimentData.sectorRotation.laggards.map((sector, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm">{sector.sector}</span>
                        <div className="flex items-center gap-1 text-red-500">
                          <TrendingDown className="h-3 w-3" />
                          <span className="text-sm font-medium">
                            {sector.change.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketSentimentDashboard;