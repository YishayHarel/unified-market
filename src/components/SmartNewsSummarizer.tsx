import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, RefreshCw } from "lucide-react";
import { useAIFunction } from "@/hooks/useAIFunction";
import AIStateNotice from "@/components/ai/AIStateNotice";

interface SummarizerResponse {
  marketSentiment?: string;
  keyThemes?: string[];
  majorEvents?: Array<{ event?: string; impact?: string; affectedSectors?: string[] }>;
  stocksInFocus?: Array<{ symbol?: string; reason?: string }>;
  riskFactors?: string[];
  summary?: string;
}

function sentimentVariant(sentiment?: string) {
  const s = (sentiment ?? "").toLowerCase();
  if (s.includes("bull")) return "default" as const;
  if (s.includes("bear")) return "destructive" as const;
  return "secondary" as const;
}

const SmartNewsSummarizer = () => {
  const { data, loading, error, invoke } = useAIFunction<SummarizerResponse>("smart-news-summarizer");

  // No arguments: the function scopes itself to the reader's holdings and
  // watchlist server-side, using the ticker tags applied at ingest.
  useEffect(() => {
    void invoke();
  }, [invoke]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-primary" />
              Smart News Summary
            </CardTitle>
            <CardDescription>Headlines touching your holdings, condensed</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void invoke()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {!loading && error && <AIStateNotice error={error} onRetry={() => void invoke()} />}

        {!loading && !error && data && (
          <>
            {data.marketSentiment && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Tone</span>
                <Badge variant={sentimentVariant(data.marketSentiment)} className="capitalize">
                  {data.marketSentiment}
                </Badge>
              </div>
            )}

            {data.summary && <p className="text-sm">{data.summary}</p>}

            {data.keyThemes && data.keyThemes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.keyThemes.map((theme, i) => (
                  <Badge key={i} variant="outline">{theme}</Badge>
                ))}
              </div>
            )}

            {data.majorEvents && data.majorEvents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">What happened</h4>
                {data.majorEvents.map((event, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-1">
                    <p className="text-sm font-medium">{event.event}</p>
                    {event.impact && (
                      <p className="text-xs text-muted-foreground">{event.impact}</p>
                    )}
                    {event.affectedSectors && event.affectedSectors.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {event.affectedSectors.map((sector, j) => (
                          <Badge key={j} variant="secondary" className="text-xs">{sector}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {data.stocksInFocus && data.stocksInFocus.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">In focus</h4>
                {data.stocksInFocus.map((stock, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    {stock.symbol && (
                      <Badge variant="secondary" className="shrink-0 h-fit">{stock.symbol}</Badge>
                    )}
                    <span className="text-muted-foreground">{stock.reason}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Summarised from published headlines. Not investment advice.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SmartNewsSummarizer;
