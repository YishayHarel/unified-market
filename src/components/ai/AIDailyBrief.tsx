import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sun, TrendingUp, TrendingDown, Minus, RefreshCw, 
  AlertTriangle, Target, Clock, BarChart3, Activity,
  ArrowUpCircle, ArrowDownCircle, MinusCircle, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface FuturesData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface StockPrediction {
  symbol: string;
  companyName: string;
  sentiment: string;
  confidence: number;
  priceTarget: string;
  reasoning: string;
  action: string;
}

interface MorningBrief {
  greeting: string;
  generatedAt: string;
  preMarketSummary?: {
    headline: string;
    futuresAnalysis: string;
    vixAnalysis: string;
    treasuryAnalysis: string;
  };
  marketSentiment?: {
    tier: string;
    confidence: number;
    reasoning: string;
  };
  thirtyMinutePrediction?: {
    direction: string;
    confidence: number;
    action: string;
    reasoning: string;
  };
  stockPredictions?: StockPrediction[];
  keyWatchPoints?: string[];
  riskFactors?: string[];
  closingAdvice?: string;
  marketData?: {
    futures: FuturesData[];
    vix: { value: number; change: number } | null;
    treasury2Y: { value: number; change: number } | null;
    treasury10Y: { value: number; change: number } | null;
    yieldSpread: number | null;
  };
  calculatedSentiment?: {
    sentiment: string;
    confidence: number;
    direction: string;
    action: string;
  };
  error?: string;
}

const getSentimentColor = (sentiment: string): string => {
  const lower = sentiment.toLowerCase();
  if (lower.includes('very bullish')) return 'bg-green-600 text-white';
  if (lower.includes('bullish')) return 'bg-green-500 text-white';
  if (lower.includes('slightly bullish')) return 'bg-green-400 text-white';
  if (lower.includes('neutral')) return 'bg-gray-500 text-white';
  if (lower.includes('slightly bearish')) return 'bg-orange-400 text-white';
  if (lower.includes('bearish')) return 'bg-red-500 text-white';
  if (lower.includes('very bearish')) return 'bg-red-700 text-white';
  return 'bg-muted text-muted-foreground';
};

const getActionColor = (action: string): string => {
  const upper = action.toUpperCase();
  if (upper === 'BUY') return 'bg-green-500 text-white';
  if (upper === 'SELL') return 'bg-red-500 text-white';
  if (upper === 'HOLD') return 'bg-yellow-500 text-black';
  return 'bg-muted text-muted-foreground';
};

const getDirectionIcon = (direction: string) => {
  const upper = direction.toUpperCase();
  if (upper === 'UP') return <ArrowUpCircle className="h-6 w-6 text-green-500" />;
  if (upper === 'DOWN') return <ArrowDownCircle className="h-6 w-6 text-red-500" />;
  return <MinusCircle className="h-6 w-6 text-yellow-500" />;
};

const AIDailyBrief = () => {
  const { user } = useAuth();
  const [brief, setBrief] = useState<MorningBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateBrief = async () => {
    if (!user) {
      toast.error('Please sign in to generate your morning brief');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('morning-market-brief', {
        body: { userId: user.id }
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setBrief(data);
      toast.success('Morning brief generated!');
    } catch (err: any) {
      console.error('Error generating brief:', err);
      setError(err.message || 'Failed to generate morning brief');
      toast.error('Failed to generate brief');
    } finally {
      setLoading(false);
    }
  };

  if (!brief && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-yellow-500" />
            Morning Market Brief
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-primary/10">
                <Clock className="h-12 w-12 text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-semibold">Your Pre-Market Intelligence</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Get AI-powered analysis of futures, VIX, Treasury yields, and personalized stock predictions before market open.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Badge variant="outline">Futures Analysis</Badge>
              <Badge variant="outline">VIX & Volatility</Badge>
              <Badge variant="outline">Treasury Yields</Badge>
              <Badge variant="outline">30-Min Prediction</Badge>
              <Badge variant="outline">Stock Predictions</Badge>
            </div>
            <Button onClick={generateBrief} className="mt-4" size="lg">
              <Sun className="h-4 w-4 mr-2" />
              Generate Morning Brief
            </Button>
            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-yellow-500" />
            Morning Market Brief
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Analyzing markets...</span>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-yellow-500" />
              Morning Market Brief
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={generateBrief} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{brief?.greeting}</p>
        </CardHeader>
        <CardContent>
          {brief?.preMarketSummary && (
            <div className="space-y-3">
              <h4 className="font-semibold text-lg">{brief.preMarketSummary.headline}</h4>
              <div className="grid gap-2 text-sm">
                <p><strong>Futures:</strong> {brief.preMarketSummary.futuresAnalysis}</p>
                <p><strong>VIX:</strong> {brief.preMarketSummary.vixAnalysis}</p>
                <p><strong>Treasury:</strong> {brief.preMarketSummary.treasuryAnalysis}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Market Data Cards */}
      {brief?.marketData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Futures Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Futures
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {brief.marketData.futures.map((f) => (
                <div key={f.symbol} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{f.symbol}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{f.price.toLocaleString()}</span>
                    <Badge variant={f.changePercent >= 0 ? "default" : "destructive"} className="text-xs">
                      {f.changePercent >= 0 ? '+' : ''}{f.changePercent.toFixed(2)}%
                    </Badge>
                  </div>
                </div>
              ))}
              {brief.marketData.futures.length === 0 && (
                <p className="text-sm text-muted-foreground">Futures data unavailable</p>
              )}
            </CardContent>
          </Card>

          {/* VIX Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                VIX (Fear Index)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {brief.marketData.vix ? (
                <div className="text-center">
                  <div className="text-3xl font-bold">{brief.marketData.vix.value.toFixed(2)}</div>
                  <Badge variant={brief.marketData.vix.change >= 0 ? "destructive" : "default"} className="mt-1">
                    {brief.marketData.vix.change >= 0 ? '+' : ''}{brief.marketData.vix.change.toFixed(2)}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    {brief.marketData.vix.value < 15 ? 'Low volatility' : 
                     brief.marketData.vix.value < 25 ? 'Moderate volatility' : 
                     brief.marketData.vix.value < 35 ? 'High volatility' : 'Extreme volatility'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">VIX data unavailable</p>
              )}
            </CardContent>
          </Card>

          {/* Treasury Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Treasury Yields
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {brief.marketData.treasury2Y && (
                <div className="flex justify-between items-center">
                  <span className="text-sm">2-Year</span>
                  <span className="text-sm font-medium">{brief.marketData.treasury2Y.value.toFixed(2)}%</span>
                </div>
              )}
              {brief.marketData.treasury10Y && (
                <div className="flex justify-between items-center">
                  <span className="text-sm">10-Year</span>
                  <span className="text-sm font-medium">{brief.marketData.treasury10Y.value.toFixed(2)}%</span>
                </div>
              )}
              {brief.marketData.yieldSpread !== null && (
                <div className="flex justify-between items-center pt-1 border-t">
                  <span className="text-sm">Spread</span>
                  <Badge variant={brief.marketData.yieldSpread >= 0 ? "default" : "destructive"}>
                    {brief.marketData.yieldSpread.toFixed(2)}%
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sentiment & 30-Min Prediction */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Market Sentiment */}
        {brief?.marketSentiment && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Market Sentiment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Badge className={`text-lg px-4 py-1 ${getSentimentColor(brief.marketSentiment.tier)}`}>
                  {brief.marketSentiment.tier}
                </Badge>
                <span className="text-2xl font-bold">{brief.marketSentiment.confidence}%</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{brief.marketSentiment.reasoning}</p>
            </CardContent>
          </Card>
        )}

        {/* 30-Minute Prediction */}
        {brief?.thirtyMinutePrediction && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                First 30 Minutes Prediction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {getDirectionIcon(brief.thirtyMinutePrediction.direction)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{brief.thirtyMinutePrediction.direction}</span>
                    <span className="text-muted-foreground">({brief.thirtyMinutePrediction.confidence}% confidence)</span>
                  </div>
                  <Badge className={`mt-1 ${getActionColor(brief.thirtyMinutePrediction.action)}`}>
                    {brief.thirtyMinutePrediction.action}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{brief.thirtyMinutePrediction.reasoning}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stock Predictions */}
      {brief?.stockPredictions && brief.stockPredictions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Your Stock Predictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {brief.stockPredictions.map((stock, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-lg">{stock.symbol}</span>
                      <span className="text-muted-foreground text-sm ml-2">{stock.companyName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getSentimentColor(stock.sentiment)}>{stock.sentiment}</Badge>
                      <span className="font-semibold">{stock.confidence}%</span>
                      <Badge className={getActionColor(stock.action)}>{stock.action}</Badge>
                    </div>
                  </div>
                  <p className="text-sm"><strong>Target:</strong> {stock.priceTarget}</p>
                  <p className="text-sm text-muted-foreground">{stock.reasoning}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Watch Points & Risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {brief?.keyWatchPoints && brief.keyWatchPoints.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />
                Key Watch Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {brief.keyWatchPoints.map((point, idx) => (
                  <li key={idx} className="text-sm flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {brief?.riskFactors && brief.riskFactors.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Risk Factors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {brief.riskFactors.map((risk, idx) => (
                  <li key={idx} className="text-sm flex items-start gap-2">
                    <span className="text-yellow-500">•</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Closing Advice */}
      {brief?.closingAdvice && (
        <Card className="bg-primary/5">
          <CardContent className="pt-4">
            <p className="text-sm italic text-center">{brief.closingAdvice}</p>
          </CardContent>
        </Card>
      )}

      {/* Generated timestamp */}
      {brief?.generatedAt && (
        <p className="text-xs text-muted-foreground text-center">
          Generated at {new Date(brief.generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
};

export default AIDailyBrief;
