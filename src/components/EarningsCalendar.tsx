import { useState, useEffect, useCallback } from "react";
import { Search, Calendar, Building2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EarningsData {
  symbol: string;
  date: string;
  epsEstimate?: number;
  epsActual?: number;
  hour: string;
  quarter: number;
  year: number;
  market_cap?: number;
  company_name?: string;
}

async function invokeEarnings(body: { from: string; to: string; symbol?: string }) {
  const { data, error } = await supabase.functions.invoke("get-earnings", { body });
  if (error) {
    return { list: [] as EarningsData[], message: error.message };
  }
  const payload = data as { earningsCalendar?: EarningsData[]; error?: string };
  if (payload?.error) {
    return { list: payload.earningsCalendar ?? [], message: payload.error };
  }
  return { list: payload?.earningsCalendar ?? [], message: null as string | null };
}

const EarningsCalendar = () => {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<EarningsData[]>([]);
  const [filteredEarnings, setFilteredEarnings] = useState<EarningsData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [displayCount, setDisplayCount] = useState(20);
  const [listError, setListError] = useState<string | null>(null);

  const loadDefaultRange = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const today = new Date();
      const end = new Date(today);
      end.setDate(today.getDate() + 60);
      const fromDate = today.toISOString().split("T")[0];
      const toDate = end.toISOString().split("T")[0];

      const { list, message } = await invokeEarnings({ from: fromDate, to: toDate });
      if (message) setListError(message);
      setEarnings(list);
    } catch (e) {
      console.error("Error fetching earnings:", e);
      setListError(e instanceof Error ? e.message : "Failed to load earnings");
      setEarnings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDefaultRange();
  }, [loadDefaultRange]);

  // When not searching, show first N rows from the cached full list (no refetch on "Load more")
  useEffect(() => {
    if (searchQuery.trim()) return;
    setFilteredEarnings(earnings.slice(0, displayCount));
  }, [displayCount, earnings, searchQuery]);

  useEffect(() => {
    const run = async () => {
      if (!searchQuery.trim()) {
        return;
      }

      try {
        const raw = searchQuery.trim();
        const query = raw.toLowerCase();

        const isoDate = raw.match(/^\d{4}-\d{2}-\d{2}$/);
        const usSlash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        const usDash = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        const monthDay = raw.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})(?:,?\s*(\d{4}))?$/i);

        let searchDateStr: string | null = null;

        if (isoDate) {
          searchDateStr = raw;
        } else if (usSlash) {
          const [, m, d, y] = usSlash;
          searchDateStr = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        } else if (usDash) {
          const [, m, d, y] = usDash;
          searchDateStr = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        } else if (monthDay) {
          const monthName = monthDay[1];
          const dayNum = monthDay[2];
          const yearNum = monthDay[3] || String(new Date().getFullYear());
          const tryParse = new Date(`${monthName} ${dayNum}, ${yearNum}`);
          if (!Number.isNaN(tryParse.getTime())) {
            searchDateStr = tryParse.toISOString().split("T")[0];
          }
        }

        if (searchDateStr) {
          setListError(null);
          const { list, message } = await invokeEarnings({ from: searchDateStr, to: searchDateStr });
          if (message) setListError(message);
          setFilteredEarnings(list);
          return;
        }

        const majorStockMap: Record<string, string> = {
          apple: "AAPL",
          microsoft: "MSFT",
          nvidia: "NVDA",
          google: "GOOGL",
          alphabet: "GOOGL",
          amazon: "AMZN",
          tesla: "TSLA",
          meta: "META",
          facebook: "META",
          netflix: "NFLX",
          disney: "DIS",
          boeing: "BA",
          walmart: "WMT",
          jpmorgan: "JPM",
          visa: "V",
          mastercard: "MA",
          intel: "INTC",
          amd: "AMD",
        };

        let targetSymbol: string | null = null;
        if (/^[A-Za-z]{1,5}$/.test(raw.trim())) {
          targetSymbol = raw.trim().toUpperCase();
        } else {
          for (const [name, symbol] of Object.entries(majorStockMap)) {
            if (query === name || query.includes(name) || name.includes(query)) {
              targetSymbol = symbol;
              break;
            }
          }
        }

        if (targetSymbol) {
          const today = new Date();
          const horizon = new Date();
          horizon.setDate(today.getDate() + 180);
          setListError(null);
          const { list, message } = await invokeEarnings({
            from: today.toISOString().split("T")[0],
            to: horizon.toISOString().split("T")[0],
            symbol: targetSymbol,
          });
          if (message) setListError(message);
          setFilteredEarnings(list);
          return;
        }

        const { data: stockMatches, error: searchError } = await (supabase.from("stocks") as any)
          .select("symbol, name, market_cap")
          .or(`symbol.ilike.%${query}%,name.ilike.%${query}%`)
          .order("market_cap", { ascending: false })
          .limit(5);

        if (searchError) throw searchError;

        if (stockMatches?.length) {
          const symbol = stockMatches[0].symbol as string;
          const today = new Date();
          const horizon = new Date();
          horizon.setDate(today.getDate() + 180);
          setListError(null);
          const { list, message } = await invokeEarnings({
            from: today.toISOString().split("T")[0],
            to: horizon.toISOString().split("T")[0],
            symbol,
          });
          if (message) setListError(message);
          setFilteredEarnings(list);
        } else {
          setFilteredEarnings([]);
        }
      } catch (err) {
        console.error("Search error:", err);
        setFilteredEarnings([]);
        setListError(err instanceof Error ? err.message : "Search failed");
      }
    };

    const debounceTimer = setTimeout(run, 350);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  if (loading) {
    return (
      <section>
        <h2 className="text-2xl font-semibold mb-4">🗓 Earnings Calendar</h2>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-card p-4 rounded-lg animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-3/4 mb-1"></div>
              <div className="h-3 bg-muted rounded w-1/2 mb-1"></div>
              <div className="h-3 bg-muted rounded w-1/3"></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (hour: string) => {
    switch (hour?.toLowerCase()) {
      case "bmo":
        return "Before Market Open";
      case "amc":
        return "After Market Close";
      case "dmh":
        return "During Market Hours";
      default:
        return hour ? String(hour) : "TBD";
    }
  };

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(1)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(1)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(1)}M`;
    return marketCap > 0 ? `$${marketCap.toLocaleString()}` : "N/A";
  };

  const getMarketCapBadgeVariant = (marketCap: number) => {
    if (marketCap >= 100e9) return "default";
    if (marketCap >= 10e9) return "secondary";
    return "outline";
  };

  const groupEarningsByDate = (earningsData: EarningsData[]) => {
    const grouped = earningsData.reduce(
      (acc, earning) => {
        const date = earning.date;
        if (!date) return acc;
        if (!acc[date]) acc[date] = [];
        acc[date].push(earning);
        return acc;
      },
      {} as Record<string, EarningsData[]>
    );

    Object.keys(grouped).forEach((date) => {
      grouped[date].sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
    });

    return grouped;
  };

  const groupedEarnings = groupEarningsByDate(filteredEarnings);
  const sortedDates = Object.keys(groupedEarnings).sort();

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">🗓 Earnings Calendar</h2>

      {listError && (
        <p className="mb-4 text-sm text-amber-600 dark:text-amber-500" role="alert">
          {listError}
        </p>
      )}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Ticker (AAPL), company name, or date (2026-04-15, 4/15/2026, Apr 15)…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-card"
        />
      </div>

      {searchQuery.length === 0 && (
        <div className="mb-4 text-xs text-muted-foreground flex flex-wrap gap-2 items-center">
          <span>Try:</span>
          <button type="button" onClick={() => setSearchQuery("AAPL")} className="bg-muted px-2 py-1 rounded hover:bg-muted/80">
            AAPL
          </button>
          <button type="button" onClick={() => setSearchQuery("Microsoft")} className="bg-muted px-2 py-1 rounded hover:bg-muted/80">
            Microsoft
          </button>
          <button type="button" onClick={() => setSearchQuery("2026-04-22")} className="bg-muted px-2 py-1 rounded hover:bg-muted/80">
            2026-04-22
          </button>
        </div>
      )}

      <div className="mb-4 text-sm text-muted-foreground">
        {searchQuery.trim()
          ? `Showing ${filteredEarnings.length} result(s) for “${searchQuery.trim()}”`
          : `Showing ${filteredEarnings.length} of ${earnings.length} upcoming earnings (next ~60 days)`}
      </div>

      <div className="space-y-6">
        {sortedDates.map((date) => (
          <div key={date}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4" />
              <h3 className="text-lg font-semibold">{formatDate(date)}</h3>
              <Badge variant="outline">{groupedEarnings[date].length} companies</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedEarnings[date].map((earning, index) => (
                <Card key={`${earning.symbol}-${date}-${index}`} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <span className="font-bold text-lg">{earning.symbol}</span>
                      {(earning.market_cap ?? 0) > 0 && (
                        <Badge variant={getMarketCapBadgeVariant(earning.market_cap ?? 0)}>
                          {formatMarketCap(earning.market_cap ?? 0)}
                        </Badge>
                      )}
                    </CardTitle>
                    {earning.company_name && earning.company_name !== earning.symbol && (
                      <p className="text-sm text-muted-foreground">{earning.company_name}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-3 w-3" />
                      <span>
                        EPS est:{" "}
                        {earning.epsEstimate != null && Number.isFinite(Number(earning.epsEstimate))
                          ? `$${Number(earning.epsEstimate).toFixed(2)}`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-3 w-3" />
                      <span>{formatTime(earning.hour)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Q{earning.quarter} {earning.year}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!searchQuery.trim() && filteredEarnings.length >= displayCount && earnings.length > displayCount && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setDisplayCount((prev) => prev + 20)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Load more
          </button>
        </div>
      )}

      {filteredEarnings.length === 0 && !loading && (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {searchQuery.trim()
              ? `No earnings found for “${searchQuery.trim()}”. Try another ticker, company name, or date.`
              : "No earnings in the selected window. Try widening the range or search by symbol."}
          </p>
        </div>
      )}
    </section>
  );
};

export default EarningsCalendar;
