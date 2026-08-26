import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Coffee, RefreshCw, AlertTriangle } from "lucide-react";
import { useAIFunction } from "@/hooks/useAIFunction";
import AIStateNotice from "@/components/ai/AIStateNotice";

interface DailyBriefResponse {
  greeting?: string;
  marketOverview?: {
    sentiment?: string;
    summary?: string;
    keyDrivers?: string[];
  };
  portfolioHighlights?: Array<{ symbol?: string; message?: string; sentiment?: string }>;
  watchlistUpdates?: Array<{ symbol?: string; message?: string; action?: string }>;
  riskAlerts?: Array<{ message?: string; severity?: string }>;
  closingThought?: string;
}

function sentimentClass(sentiment?: string) {
  const s = (sentiment ?? "").toLowerCase();
  if (s.includes("pos") || s.includes("bull")) return "text-green-500";
  if (s.includes("neg") || s.includes("bear")) return "text-red-500";
  return "text-muted-foreground";
}

function severityVariant(severity?: string) {
  const s = (severity ?? "").toLowerCase();
  if (s === "high") return "destructive" as const;
  if (s === "medium") return "default" as const;
  return "secondary" as const;
}

const AIDailyBrief = () => {
  const { data, loading, error, invoke } = useAIFunction<DailyBriefResponse>("ai-daily-brief");

  useEffect(() => {
    void invoke();
  }, [invoke]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5 text-primary" />
              Daily Brief
            </CardTitle>
            <CardDescription>Your holdings and watchlist, summarised for the day</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void invoke()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {!loading && error && <AIStateNotice error={error} onRetry={() => void invoke()} />}

        {!loading && !error && data && (
          <>
            {data.greeting && <p className="text-sm font-medium">{data.greeting}</p>}

            {data.marketOverview && (
              <div className="rounded-lg border p-3 space-y-2">
                {data.marketOverview.sentiment && (
                  <Badge variant="outline">{data.marketOverview.sentiment}</Badge>
                )}
                {data.marketOverview.summary && (
                  <p className="text-sm">{data.marketOverview.summary}</p>
                )}
                {data.marketOverview.keyDrivers && data.marketOverview.keyDrivers.length > 0 && (
                  <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                    {data.marketOverview.keyDrivers.map((driver, i) => <li key={i}>{driver}</li>)}
                  </ul>
                )}
              </div>
            )}

            {data.portfolioHighlights && data.portfolioHighlights.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Your positions</h4>
                {data.portfolioHighlights.map((item, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    {item.symbol && (
                      <Badge variant="secondary" className="shrink-0 h-fit">{item.symbol}</Badge>
                    )}
                    <span className={sentimentClass(item.sentiment)}>{item.message}</span>
                  </div>
                ))}
              </div>
            )}

            {data.watchlistUpdates && data.watchlistUpdates.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Watchlist</h4>
                {data.watchlistUpdates.map((item, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    {item.symbol && (
                      <Badge variant="secondary" className="shrink-0 h-fit">{item.symbol}</Badge>
                    )}
                    <span className="text-muted-foreground">{item.message}</span>
                  </div>
                ))}
              </div>
            )}

            {data.riskAlerts && data.riskAlerts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  Watch out for
                </h4>
                {data.riskAlerts.map((alert, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <Badge variant={severityVariant(alert.severity)} className="shrink-0 h-fit">
                      {alert.severity ?? "note"}
                    </Badge>
                    <span className="text-muted-foreground">{alert.message}</span>
                  </div>
                ))}
              </div>
            )}

            {data.closingThought && (
              <p className="text-xs text-muted-foreground italic">{data.closingThought}</p>
            )}

            <p className="text-xs text-muted-foreground">Information only. Not investment advice.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AIDailyBrief;
