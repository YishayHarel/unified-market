import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, TrendingUp, TrendingDown, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface AnalystRatingsProps {
  symbol: string;
}

interface RecommendationTrend {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  period: string;
}

interface PriceTarget {
  targetHigh: number;
  targetLow: number;
  targetMean: number;
  targetMedian: number;
}

const AnalystRatings = ({ symbol }: AnalystRatingsProps) => {
  const [recommendations, setRecommendations] = useState<RecommendationTrend | null>(null);
  const [priceTarget, setPriceTarget] = useState<PriceTarget | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalystData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-stock-fundamentals', {
        body: { symbol }
      });

      if (fnError) throw fnError;

      // Extract recommendation trends (most recent period)
      if (data?.recommendationTrends && data.recommendationTrends.length > 0) {
        const latest = data.recommendationTrends[0];
        setRecommendations({
          strongBuy: latest.strongBuy || 0,
          buy: latest.buy || 0,
          hold: latest.hold || 0,
          sell: latest.sell || 0,
          strongSell: latest.strongSell || 0,
          period: latest.period || 'Current'
        });
      }

      // Extract price target
      if (data?.priceTarget) {
        setPriceTarget({
          targetHigh: data.priceTarget.targetHigh,
          targetLow: data.priceTarget.targetLow,
          targetMean: data.priceTarget.targetMean,
          targetMedian: data.priceTarget.targetMedian
        });
      }

      // Get current price for upside calculation
      if (data?.quote?.c) {
        setCurrentPrice(data.quote.c);
      }

    } catch (err) {
      console.error('Error fetching analyst ratings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analyst ratings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (symbol) {
      fetchAnalystData();
    }
  }, [symbol]);

  if (loading) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="w-5 h-5 text-primary animate-pulse" />
            Analyst Ratings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <div className="animate-pulse text-muted-foreground">Loading analyst data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !recommendations) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="w-5 h-5 text-primary" />
            Analyst Ratings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-muted-foreground text-center text-sm">
            {error || 'No analyst data available for this stock'}
          </p>
          <Button variant="outline" size="sm" onClick={fetchAnalystData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalAnalysts = recommendations.strongBuy + recommendations.buy + recommendations.hold + recommendations.sell + recommendations.strongSell;
  
  // Calculate weighted average (5=strong buy, 1=strong sell)
  const weightedSum = (recommendations.strongBuy * 5) + (recommendations.buy * 4) + (recommendations.hold * 3) + (recommendations.sell * 2) + (recommendations.strongSell * 1);
  const avgRating = totalAnalysts > 0 ? weightedSum / totalAnalysts : 0;

  const ratings = [
    { type: "Strong Buy", count: recommendations.strongBuy, percentage: totalAnalysts > 0 ? (recommendations.strongBuy / totalAnalysts) * 100 : 0, color: "bg-green-500" },
    { type: "Buy", count: recommendations.buy, percentage: totalAnalysts > 0 ? (recommendations.buy / totalAnalysts) * 100 : 0, color: "bg-green-400" },
    { type: "Hold", count: recommendations.hold, percentage: totalAnalysts > 0 ? (recommendations.hold / totalAnalysts) * 100 : 0, color: "bg-yellow-500" },
    { type: "Sell", count: recommendations.sell, percentage: totalAnalysts > 0 ? (recommendations.sell / totalAnalysts) * 100 : 0, color: "bg-red-400" },
    { type: "Strong Sell", count: recommendations.strongSell, percentage: totalAnalysts > 0 ? (recommendations.strongSell / totalAnalysts) * 100 : 0, color: "bg-red-500" }
  ];

  const getRatingColor = (type: string) => {
    switch (type) {
      case "Strong Buy": return "text-green-400";
      case "Buy": return "text-green-300";
      case "Hold": return "text-yellow-400";
      case "Sell": return "text-red-400";
      case "Strong Sell": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  const getOverallRating = (avg: number) => {
    if (avg >= 4.0) return { text: "Strong Buy", color: "text-green-400" };
    if (avg >= 3.5) return { text: "Buy", color: "text-green-300" };
    if (avg >= 2.5) return { text: "Hold", color: "text-yellow-400" };
    if (avg >= 1.5) return { text: "Sell", color: "text-red-400" };
    return { text: "Strong Sell", color: "text-red-500" };
  };

  const overallRating = getOverallRating(avgRating);

  // Calculate upside/downside
  const targetPrice = priceTarget?.targetMean || priceTarget?.targetMedian;
  const upside = targetPrice && currentPrice ? ((targetPrice / currentPrice - 1) * 100) : null;

  return (
    <Card className="bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="w-5 h-5 text-primary" />
            Analyst Ratings
          </CardTitle>
          <Badge variant="outline" className="text-green-500 border-green-500">
            Live Data
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Rating */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl font-bold">{avgRating.toFixed(1)}</span>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.round(avgRating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className={`font-medium ${overallRating.color}`}>
            {overallRating.text}
          </div>
          <div className="text-sm text-muted-foreground">
            Based on {totalAnalysts} analyst{totalAnalysts !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Price Target */}
        {targetPrice && (
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Avg Price Target</span>
              {upside !== null && (
                upside >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )
              )}
            </div>
            <div className={`text-xl font-bold ${upside !== null && upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${targetPrice.toFixed(2)}
            </div>
            {upside !== null && (
              <div className={`text-sm ${upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {upside >= 0 ? '+' : ''}{upside.toFixed(1)}% {upside >= 0 ? 'upside' : 'downside'}
              </div>
            )}
            {priceTarget && (
              <div className="text-xs text-muted-foreground mt-1">
                Range: ${priceTarget.targetLow?.toFixed(2)} - ${priceTarget.targetHigh?.toFixed(2)}
              </div>
            )}
          </div>
        )}

        {/* Rating Breakdown */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Rating Breakdown</h4>
          {ratings.map((rating, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className={getRatingColor(rating.type)}>{rating.type}</span>
                <span className="text-muted-foreground">
                  {rating.count} ({rating.percentage.toFixed(0)}%)
                </span>
              </div>
              <Progress 
                value={rating.percentage} 
                className="h-2"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalystRatings;