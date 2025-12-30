import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sun, Loader2, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface PortfolioHighlight {
  symbol: string;
  message: string;
  sentiment: "positive" | "negative" | "neutral";
}

interface WatchlistUpdate {
  symbol: string;
  message: string;
  action: "watch" | "consider" | "alert";
}

interface Opportunity {
  symbol: string;
  reason: string;
  type: "momentum" | "value" | "breakout";
}

interface RiskAlert {
  message: string;
  severity: "high" | "medium" | "low";
}

interface DailyBriefResult {
  greeting: string;
  marketOverview: {
    sentiment: string;
    summary: string;
    keyDrivers: string[];
  };
  portfolioHighlights: PortfolioHighlight[];
  watchlistUpdates: WatchlistUpdate[];
  topOpportunities: Opportunity[];
  riskAlerts: RiskAlert[];
  actionItems: string[];
  closingThought: string;
  generatedAt: string;
}

const AIDailyBrief = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DailyBriefResult | null>(null);

  const generateBrief = async () => {
    if (!user) {
      toast.error("Please sign in to get your daily brief");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-daily-brief', {
        body: { userId: user.id }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setResult(data);
    } catch (error: any) {
      console.error("Daily Brief error:", error);
      toast.error(error.message || "Failed to generate daily brief");
    } finally {
      setLoading(false);
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return <TrendingUp className="h-3 w-3 text-green-500" />;
      case "negative": return <TrendingDown className="h-3 w-3 text-red-500" />;
      default: return null;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "alert": return <Badge variant="destructive">{action}</Badge>;
      case "consider": return <Badge className="bg-yellow-500">{action}</Badge>;
      default: return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "momentum": return <Badge className="bg-blue-500">{type}</Badge>;
      case "breakout": return <Badge className="bg-purple-500">{type}</Badge>;
      case "value": return <Badge className="bg-green-500">{type}</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-yellow-500" />
            AI Daily Brief
          </CardTitle>
          <Button onClick={generateBrief} disabled={loading || !user}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {loading ? "Generating..." : "Get Brief"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!user && (
          <div className="text-center py-8 text-muted-foreground">
            Sign in to get your personalized daily brief.
          </div>
        )}

        {user && !result && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Sun className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Get Brief" for your personalized market update.</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">AI is preparing your brief...</p>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-6">
            {/* Greeting */}
            <div className="text-lg font-medium">{result.greeting}</div>

            {/* Market Overview */}
            {result.marketOverview && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">Market Overview</h4>
                  <Badge variant={
                    result.marketOverview.sentiment === "Bullish" ? "default" :
                    result.marketOverview.sentiment === "Bearish" ? "destructive" : "secondary"
                  }>
                    {result.marketOverview.sentiment}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{result.marketOverview.summary}</p>
                {result.marketOverview.keyDrivers && (
                  <div className="flex flex-wrap gap-1">
                    {result.marketOverview.keyDrivers.map((driver, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{driver}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Portfolio Highlights */}
            {result.portfolioHighlights && result.portfolioHighlights.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Portfolio Highlights</h4>
                <div className="space-y-2">
                  {result.portfolioHighlights.map((ph, i) => (
                    <div 
                      key={i} 
                      className="flex items-center gap-3 p-2 bg-muted/20 rounded cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => navigate(`/stock/${ph.symbol}`)}
                    >
                      {getSentimentIcon(ph.sentiment)}
                      <span className="font-medium">{ph.symbol}</span>
                      <span className="text-sm text-muted-foreground flex-1">{ph.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Watchlist Updates */}
            {result.watchlistUpdates && result.watchlistUpdates.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Watchlist Updates</h4>
                <div className="space-y-2">
                  {result.watchlistUpdates.map((wu, i) => (
                    <div 
                      key={i} 
                      className="flex items-center gap-3 p-2 bg-muted/20 rounded cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => navigate(`/stock/${wu.symbol}`)}
                    >
                      <span className="font-medium">{wu.symbol}</span>
                      <span className="text-sm text-muted-foreground flex-1">{wu.message}</span>
                      {getActionBadge(wu.action)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Opportunities */}
            {result.topOpportunities && result.topOpportunities.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Top Opportunities
                </h4>
                <div className="space-y-2">
                  {result.topOpportunities.map((opp, i) => (
                    <div 
                      key={i} 
                      className="p-3 border rounded-lg cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => navigate(`/stock/${opp.symbol}`)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{opp.symbol}</span>
                        {getTypeBadge(opp.type)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{opp.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Alerts */}
            {result.riskAlerts && result.riskAlerts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Risk Alerts
                </h4>
                <div className="space-y-2">
                  {result.riskAlerts.map((alert, i) => (
                    <div key={i} className={`p-2 rounded border-l-4 ${
                      alert.severity === "high" ? "border-red-500 bg-red-500/10" :
                      alert.severity === "medium" ? "border-yellow-500 bg-yellow-500/10" :
                      "border-green-500 bg-green-500/10"
                    }`}>
                      <p className="text-sm">{alert.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {result.actionItems && result.actionItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Today's Action Items</h4>
                <ul className="list-disc list-inside space-y-1">
                  {result.actionItems.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground">{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Closing Thought */}
            {result.closingThought && (
              <div className="border-t pt-4">
                <p className="text-sm italic text-muted-foreground">{result.closingThought}</p>
              </div>
            )}

            {/* Timestamp */}
            {result.generatedAt && (
              <p className="text-xs text-muted-foreground text-right">
                Generated: {new Date(result.generatedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIDailyBrief;
