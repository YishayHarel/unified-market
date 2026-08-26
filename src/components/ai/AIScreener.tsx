import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter, Search, Info } from "lucide-react";
import { useAIFunction } from "@/hooks/useAIFunction";
import AIStateNotice from "@/components/ai/AIStateNotice";

interface ScreenerMatch {
  symbol: string;
  name: string;
  exchange?: string;
  market_cap?: number | null;
  last_return_1d?: number | null;
}

interface ScreenerResponse {
  matches?: ScreenerMatch[];
  summary?: string;
  notes?: Record<string, string>;
  caveats?: string[];
  interpretation?: Record<string, unknown>;
}

const EXAMPLES = [
  "Large caps down more than 2% today",
  "Nasdaq companies over $500B",
  "Biggest gainers on the NYSE",
];

/** Stored as a decimal fraction (0.02 = 2%), so scale before display. */
function formatReturn(value: number | null | undefined) {
  if (value == null) return "—";
  const pct = value * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function formatCap(value: number | null | undefined) {
  if (!value) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  return `$${(value / 1e6).toFixed(0)}M`;
}

const AIScreener = () => {
  const [query, setQuery] = useState("");
  const { data, loading, error, invoke } = useAIFunction<ScreenerResponse>("ai-screener");

  function run(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setQuery(q);
    void invoke({ query: q });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          AI Screener
        </CardTitle>
        <CardDescription>
          Describe what you're looking for; the filter runs against real data
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(query);
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. large caps down more than 2% today"
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !query.trim()}>
            <Search className="h-4 w-4" />
          </Button>
        </form>

        {!data && !loading && !error && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <Button key={example} variant="outline" size="sm" onClick={() => run(example)}>
                {example}
              </Button>
            ))}
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {!loading && error && <AIStateNotice error={error} onRetry={() => run(query)} />}

        {!loading && !error && data && (
          <div className="space-y-3">
            {data.summary && <p className="text-sm">{data.summary}</p>}

            {data.matches?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing in the dataset matched those criteria.
              </p>
            )}

            {data.matches?.map((match) => (
              <div key={match.symbol} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{match.symbol}</Badge>
                    <span className="text-sm font-medium">{match.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{formatCap(match.market_cap)}</span>
                    <span
                      className={
                        (match.last_return_1d ?? 0) >= 0 ? "text-green-500" : "text-red-500"
                      }
                    >
                      {formatReturn(match.last_return_1d)}
                    </span>
                  </div>
                </div>
                {data.notes?.[match.symbol] && (
                  <p className="text-xs text-muted-foreground">{data.notes[match.symbol]}</p>
                )}
              </div>
            ))}

            {/* What the screen could not evaluate, and how old the data is —
                shown rather than quietly approximated. */}
            {data.caveats && data.caveats.length > 0 && (
              <div className="flex gap-2 text-xs text-muted-foreground rounded-lg bg-muted p-3">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <ul className="space-y-1">
                  {data.caveats.map((caveat, i) => <li key={i}>{caveat}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIScreener;
