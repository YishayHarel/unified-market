import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ScreenerMatch {
  symbol: string;
  name: string;
  reason: string;
  metrics: {
    marketCap?: string;
    dayChange?: string;
    relVolume?: string;
  };
}

interface ScreenerResult {
  interpretation: string;
  matches: ScreenerMatch[];
  summary: string;
}

const EXAMPLE_QUERIES = [
  "tech stocks with high momentum",
  "large cap stocks down more than 2%",
  "stocks with unusual volume today",
  "value stocks under $50",
  "energy sector gainers"
];

const AIScreener = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScreenerResult | null>(null);

  const runScreener = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-screener', {
        body: { query: q }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setResult(data);
    } catch (error: any) {
      console.error("AI Screener error:", error);
      toast.error(error.message || "Failed to run AI screener");
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    runScreener(example);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Stock Screener
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Describe what stocks you're looking for..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runScreener()}
            className="flex-1"
          />
          <Button onClick={() => runScreener()} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Example Queries */}
        {!result && !loading && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Try these examples:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((example) => (
                <Badge
                  key={example}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => handleExampleClick(example)}
                >
                  {example}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">AI is analyzing stocks...</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Interpretation */}
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-sm font-medium">AI Understanding:</p>
              <p className="text-sm text-muted-foreground">{result.interpretation}</p>
            </div>

            {/* Matches */}
            {result.matches && result.matches.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{result.matches.length} stocks found:</p>
                <div className="space-y-2">
                  {result.matches.map((match) => (
                    <div
                      key={match.symbol}
                      className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => navigate(`/stock/${match.symbol}`)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{match.symbol}</span>
                          <span className="text-sm text-muted-foreground">{match.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{match.reason}</p>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        {match.metrics?.marketCap && (
                          <div className="text-xs">
                            <div className="text-muted-foreground">Cap</div>
                            <div>{match.metrics.marketCap}</div>
                          </div>
                        )}
                        {match.metrics?.dayChange && (
                          <div className="text-xs">
                            <div className="text-muted-foreground">Change</div>
                            <div className={match.metrics.dayChange.startsWith('+') ? 'text-green-500' : 'text-red-500'}>
                              {match.metrics.dayChange}
                            </div>
                          </div>
                        )}
                        {match.metrics?.relVolume && (
                          <div className="text-xs">
                            <div className="text-muted-foreground">Vol</div>
                            <div>{match.metrics.relVolume}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No stocks matched your criteria.
              </div>
            )}

            {/* Summary */}
            {result.summary && (
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground">{result.summary}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIScreener;
