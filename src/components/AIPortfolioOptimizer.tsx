import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, RefreshCw } from "lucide-react";
import { useAIFunction } from "@/hooks/useAIFunction";
import AIStateNotice from "@/components/ai/AIStateNotice";

interface OptimizerResponse {
  diversificationScore?: number;
  riskScore?: number;
  summary?: string;
  recommendations?: Array<{
    type?: string;
    symbol?: string;
    action?: string;
    reason?: string;
  }>;
  sectorAnalysis?: Record<string, unknown>;
}

const AIPortfolioOptimizer = () => {
  const { data, loading, error, invoke } = useAIFunction<OptimizerResponse>("ai-portfolio-optimizer");

  useEffect(() => {
    void invoke();
  }, [invoke]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Portfolio Balance
            </CardTitle>
            <CardDescription>
              Weights, diversification and where your portfolio is lopsided
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void invoke()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!loading && error && <AIStateNotice error={error} onRetry={() => void invoke()} />}

        {!loading && !error && data && (
          <>
            <div className="grid grid-cols-2 gap-4">
              {data.diversificationScore != null && (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Diversification</span>
                    <span className="text-sm font-medium">{data.diversificationScore}/10</span>
                  </div>
                  <Progress value={data.diversificationScore * 10} />
                </div>
              )}
              {data.riskScore != null && (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Risk</span>
                    <span className="text-sm font-medium">{data.riskScore}/10</span>
                  </div>
                  <Progress value={data.riskScore * 10} />
                </div>
              )}
            </div>

            {data.summary && <p className="text-sm">{data.summary}</p>}

            {data.recommendations && data.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Observations</h4>
                {data.recommendations.map((rec, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {rec.symbol && <Badge variant="secondary">{rec.symbol}</Badge>}
                      {rec.type && (
                        <Badge variant="outline" className="capitalize">{rec.type}</Badge>
                      )}
                    </div>
                    {rec.action && <p className="text-sm">{rec.action}</p>}
                    {rec.reason && (
                      <p className="text-xs text-muted-foreground">{rec.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Observations about your current weights. Not investment advice.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AIPortfolioOptimizer;
