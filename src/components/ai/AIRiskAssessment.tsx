import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, RefreshCw, PieChart } from "lucide-react";
import { useAIFunction } from "@/hooks/useAIFunction";
import AIStateNotice from "@/components/ai/AIStateNotice";

interface RiskResponse {
  riskScore?: number;
  riskLevel?: string;
  summary?: string;
  riskFactors?: Array<{ factor?: string; severity?: string; description?: string } | string>;
  concentrationAnalysis?: {
    topHolding?: { symbol?: string; weight?: string; concern?: string };
    diversificationScore?: string;
  };
  sectorExposure?: Array<{ sector?: string; weight?: string; risk?: string }>;
}

function severityVariant(severity?: string) {
  const s = (severity ?? "").toLowerCase();
  if (s.includes("high")) return "destructive" as const;
  if (s.includes("med") || s.includes("mod")) return "default" as const;
  return "secondary" as const;
}

const AIRiskAssessment = () => {
  const { data, loading, error, invoke } = useAIFunction<RiskResponse>("ai-risk-assessment");

  useEffect(() => {
    void invoke();
  }, [invoke]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Risk Assessment
            </CardTitle>
            <CardDescription>Concentration and sector exposure across your holdings</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void invoke()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!loading && error && <AIStateNotice error={error} onRetry={() => void invoke()} />}

        {!loading && !error && data && (
          <>
            {data.riskScore != null && (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Risk score</span>
                  <span className="text-sm font-medium">
                    {data.riskScore}/10 {data.riskLevel ? `· ${data.riskLevel}` : ""}
                  </span>
                </div>
                <Progress value={data.riskScore * 10} />
              </div>
            )}

            {data.summary && <p className="text-sm">{data.summary}</p>}

            {data.concentrationAnalysis?.topHolding?.symbol && (
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <PieChart className="h-4 w-4 text-primary" />
                  Largest position
                  <Badge variant="secondary">{data.concentrationAnalysis.topHolding.symbol}</Badge>
                  {data.concentrationAnalysis.topHolding.weight && (
                    <span className="text-muted-foreground font-normal">
                      {data.concentrationAnalysis.topHolding.weight}
                    </span>
                  )}
                </div>
                {data.concentrationAnalysis.topHolding.concern && (
                  <p className="text-xs text-muted-foreground">
                    {data.concentrationAnalysis.topHolding.concern}
                  </p>
                )}
              </div>
            )}

            {data.riskFactors && data.riskFactors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Risk factors</h4>
                {data.riskFactors.map((factor, i) => {
                  // The schema allows either shape; render both rather than
                  // dropping entries that came back as plain strings.
                  const isObject = typeof factor === "object" && factor !== null;
                  const label = isObject ? factor.factor : String(factor);
                  return (
                    <div key={i} className="flex gap-2 text-sm">
                      {isObject && factor.severity && (
                        <Badge variant={severityVariant(factor.severity)} className="shrink-0 h-fit">
                          {factor.severity}
                        </Badge>
                      )}
                      <div>
                        <span className="font-medium">{label}</span>
                        {isObject && factor.description && (
                          <p className="text-xs text-muted-foreground">{factor.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {data.sectorExposure && data.sectorExposure.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Sector exposure</h4>
                {data.sectorExposure.map((sector, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{sector.sector}</span>
                    <span className="text-muted-foreground">{sector.weight}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Information only. Not investment advice.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AIRiskAssessment;
