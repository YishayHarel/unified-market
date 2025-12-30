import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, AlertTriangle, TrendingUp, TrendingDown, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface RiskFactor {
  factor: string;
  severity: "High" | "Medium" | "Low";
  impact: string;
}

interface SectorExposure {
  sector: string;
  weight: string;
  risk: "High" | "Medium" | "Low";
}

interface Recommendation {
  action: string;
  priority: "High" | "Medium" | "Low";
  rationale: string;
}

interface HedgingStrategy {
  strategy: string;
  instruments: string[];
  cost: string;
}

interface RiskResult {
  riskScore: number;
  riskLevel: string;
  summary: string;
  riskFactors: RiskFactor[];
  concentrationAnalysis: {
    topHolding: { symbol: string; weight: string; concern: string };
    diversificationScore: string;
  };
  sectorExposure: SectorExposure[];
  recommendations: Recommendation[];
  hedgingStrategies: HedgingStrategy[];
  portfolio: {
    totalValue: number;
    holdingsCount: number;
  };
}

const AIRiskAssessment = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskResult | null>(null);

  const runAssessment = async () => {
    if (!user) {
      toast.error("Please sign in to assess your portfolio");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-risk-assessment', {
        body: { userId: user.id }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        if (data.suggestion) {
          toast.info(data.suggestion);
        }
        return;
      }

      setResult(data);
    } catch (error: any) {
      console.error("Risk Assessment error:", error);
      toast.error(error.message || "Failed to run risk assessment");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "high": return "text-red-500";
      case "medium": return "text-yellow-500";
      case "low": return "text-green-500";
      default: return "text-muted-foreground";
    }
  };

  const getRiskBadgeVariant = (level: string) => {
    switch (level.toLowerCase()) {
      case "high": return "destructive" as const;
      case "medium": return "secondary" as const;
      case "low": return "default" as const;
      default: return "outline" as const;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            AI Risk Assessment
          </CardTitle>
          <Button onClick={runAssessment} disabled={loading || !user}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {loading ? "Analyzing..." : "Analyze Portfolio"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!user && (
          <div className="text-center py-8 text-muted-foreground">
            Sign in to analyze your portfolio risk.
          </div>
        )}

        {user && !result && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Analyze Portfolio" to get AI-powered risk insights.</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">AI is analyzing your portfolio...</p>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-6">
            {/* Risk Score */}
            <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-lg">
              <div className="text-center">
                <div className={`text-4xl font-bold ${result.riskScore >= 7 ? 'text-red-500' : result.riskScore >= 4 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {result.riskScore}/10
                </div>
                <Badge variant={getRiskBadgeVariant(result.riskLevel)}>
                  {result.riskLevel} Risk
                </Badge>
              </div>
              <div className="flex-1">
                <Progress value={result.riskScore * 10} className="h-3" />
                <p className="text-sm text-muted-foreground mt-2">{result.summary}</p>
              </div>
            </div>

            {/* Portfolio Overview */}
            {result.portfolio && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">${result.portfolio.totalValue?.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Value</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{result.portfolio.holdingsCount}</div>
                  <div className="text-xs text-muted-foreground">Holdings</div>
                </div>
              </div>
            )}

            {/* Risk Factors */}
            {result.riskFactors && result.riskFactors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Risk Factors
                </h4>
                <div className="space-y-2">
                  {result.riskFactors.map((rf, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 bg-muted/20 rounded">
                      <Badge variant={getRiskBadgeVariant(rf.severity)} className="mt-0.5">
                        {rf.severity}
                      </Badge>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{rf.factor}</div>
                        <div className="text-xs text-muted-foreground">{rf.impact}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sector Exposure */}
            {result.sectorExposure && result.sectorExposure.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Sector Exposure</h4>
                <div className="grid grid-cols-2 gap-2">
                  {result.sectorExposure.map((se, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted/20 rounded text-sm">
                      <span>{se.sector}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{se.weight}</span>
                        <div className={`w-2 h-2 rounded-full ${
                          se.risk === "High" ? "bg-red-500" :
                          se.risk === "Medium" ? "bg-yellow-500" : "bg-green-500"
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Recommendations
                </h4>
                <div className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge variant={getRiskBadgeVariant(rec.priority)}>{rec.priority}</Badge>
                        <span className="font-medium text-sm">{rec.action}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{rec.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hedging Strategies */}
            {result.hedgingStrategies && result.hedgingStrategies.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Hedging Strategies</h4>
                <div className="space-y-2">
                  {result.hedgingStrategies.map((hs, i) => (
                    <div key={i} className="p-3 bg-muted/20 rounded-lg">
                      <div className="font-medium text-sm">{hs.strategy}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {hs.instruments.map((inst, j) => (
                          <Badge key={j} variant="outline" className="text-xs">{inst}</Badge>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Est. Cost: {hs.cost}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIRiskAssessment;
