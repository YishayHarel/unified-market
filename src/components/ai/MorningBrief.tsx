import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sunrise, RefreshCw, TrendingUp, AlertTriangle, Eye } from "lucide-react";
import { useAIFunction } from "@/hooks/useAIFunction";
import AIStateNotice from "@/components/ai/AIStateNotice";

interface MorningBriefData {
  headline?: string;
  tape?: string;
  openOdds?: {
    baseRatePct?: number;
    adjustedPct?: number;
    basis?: string;
    adjustment?: string;
  } | null;
  holdings?: Array<{ symbol: string; note: string }>;
  watch?: string[];
  risk?: string;
  baseRatesOnly?: boolean;
  note?: string;
  baseRates?: string;
  generatedAt?: string;
}

/**
 * Shows the base rate and the adjusted figure side by side, always.
 *
 * The base rate is counted from historical bars; the adjustment is the model's
 * judgement on top. Presenting only the adjusted number would hide which half
 * is measured, which is the distinction the whole feature rests on.
 */
function OpenOdds({ odds }: { odds: NonNullable<MorningBriefData["openOdds"]> }) {
  const base = odds.baseRatePct;
  const adjusted = odds.adjustedPct;
  const moved = base != null && adjusted != null && Math.round(base) !== Math.round(adjusted);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-baseline gap-4 flex-wrap">
        <div>
          <div className="text-2xl font-bold">{base != null ? `${Math.round(base)}%` : "—"}</div>
          <div className="text-xs text-muted-foreground">historical base rate</div>
        </div>
        {moved && (
          <div>
            <div className="text-2xl font-bold text-primary">{Math.round(adjusted!)}%</div>
            <div className="text-xs text-muted-foreground">adjusted for today</div>
          </div>
        )}
      </div>
      {odds.basis && <p className="text-xs text-muted-foreground">{odds.basis}</p>}
      {odds.adjustment && <p className="text-sm">{odds.adjustment}</p>}
    </div>
  );
}

const MorningBrief = () => {
  const { data, loading, error, invoke } = useAIFunction<MorningBriefData>("morning-market-brief");

  useEffect(() => {
    void invoke();
  }, [invoke]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sunrise className="h-5 w-5 text-primary" />
              Morning Brief
            </CardTitle>
            <CardDescription>Where the tape sits before the open, and what usually follows</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void invoke()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {!loading && error && <AIStateNotice error={error} onRetry={() => void invoke()} />}

        {!loading && !error && data && (
          <>
            {data.headline && <p className="text-lg font-semibold leading-snug">{data.headline}</p>}
            {data.tape && <p className="text-sm text-muted-foreground">{data.tape}</p>}

            {/* The narration can fail while the computed figures stand. */}
            {data.baseRatesOnly && data.note && (
              <p className="text-xs text-muted-foreground italic">{data.note}</p>
            )}

            {data.openOdds && <OpenOdds odds={data.openOdds} />}

            {data.holdings && data.holdings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Your holdings
                </h4>
                {data.holdings.map((holding) => (
                  <div key={holding.symbol} className="flex gap-3 text-sm">
                    <Badge variant="secondary" className="shrink-0 h-fit">{holding.symbol}</Badge>
                    <span className="text-muted-foreground">{holding.note}</span>
                  </div>
                ))}
              </div>
            )}

            {data.watch && data.watch.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Watch today
                </h4>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  {data.watch.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}

            {data.risk && (
              <div className="flex gap-2 text-sm rounded-lg bg-muted p-3">
                <AlertTriangle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{data.risk}</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground pt-1">
              Percentages are historical frequencies, not forecasts. Not investment advice.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MorningBrief;
