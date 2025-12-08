import { useState, useEffect } from "react";
import { Search, Calendar, Building2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EarningsData {
  symbol: string;
  date: string;
  epsEstimate: number;
  epsActual?: number;
  hour: string;
  quarter: number;
  year: number;
  market_cap?: number;
  company_name?: string;
}

const EarningsCalendar = () => {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<EarningsData[]>([]);
  const [filteredEarnings, setFilteredEarnings] = useState<EarningsData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [displayCount, setDisplayCount] = useState(20);

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        // Get earnings for the next 60 days to get more results
        const today = new Date();
        const nextTwoMonths = new Date(today);
        nextTwoMonths.setDate(today.getDate() + 60);

        const fromDate = today.toISOString().split('T')[0];
        const toDate = nextTwoMonths.toISOString().split('T')[0];

        console.log(`Fetching earnings from ${fromDate} to ${toDate}`);

        // Add timeout handling for the client-side call
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 20000)
        );
        
        const fetchPromise = supabase.functions.invoke('get-earnings', {
          body: { 
            from: fromDate,
            to: toDate
          }
        });
        
        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

        if (error) throw error;

        if (data?.earningsCalendar) {
          console.log(`Received ${data.earningsCalendar.length} earnings records`);
          setEarnings(data.earningsCalendar);
          setFilteredEarnings(data.earningsCalendar.slice(0, displayCount));
        }
      } catch (error) {
        console.error('Error fetching earnings:', error);
        // Set empty array on error
        setEarnings([]);
        setFilteredEarnings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, [displayCount]);

  // Filter or fetch earnings based on search query
  useEffect(() => {
    const run = async () => {
      if (!searchQuery.trim()) {
        setFilteredEarnings(earnings.slice(0, displayCount));
        return;
      }

      try {
        const query = searchQuery.trim().toLowerCase();
        
        // Check if the search query is a date (various formats)
        const dateMatch = query.match(/^\d{4}-\d{2}-\d{2}$/) || 
                         query.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/) ||
                         query.match(/^\d{1,2}-\d{1,2}-\d{4}$/) ||
                         query.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}$/i);
        
        if (dateMatch) {
          // Parse the date and filter existing earnings
          let searchDate: Date;
          
          if (query.match(/^\d{4}-\d{2}-\d{2}$/)) {
            searchDate = new Date(query + 'T00:00:00');
          } else if (query.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            searchDate = new Date(query);
          } else if (query.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
            const [month, day, year] = query.split('-');
            searchDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
          } else {
            // Handle "jan 15", "february 28", etc.
            const currentYear = new Date().getFullYear();
            searchDate = new Date(`${query} ${currentYear}`);
          }
          
          const searchDateStr = searchDate.toISOString().split('T')[0];
          const dateFiltered = earnings.filter(earning => earning.date === searchDateStr);
          setFilteredEarnings(dateFiltered);
          return;
        }

        // Define common major stocks that users might search for
        const majorStockMap: Record<string, string> = {
          'apple': 'AAPL',
          'microsoft': 'MSFT', 
          'nvidia': 'NVDA',
          'google': 'GOOGL',
          'alphabet': 'GOOGL',
          'amazon': 'AMZN',
          'tesla': 'TSLA',
          'meta': 'META',
          'facebook': 'META',
          'netflix': 'NFLX',
          'disney': 'DIS',
          'boeing': 'BA',
          'walmart': 'WMT',
          'jpmorgan': 'JPM',
          'visa': 'V',
          'mastercard': 'MA',
          'coca cola': 'KO',
          'pepsi': 'PEP',
          'procter': 'PG',
          'johnson': 'JNJ',
          'pfizer': 'PFE',
          'intel': 'INTC',
          'amd': 'AMD',
          'salesforce': 'CRM',
          'oracle': 'ORCL',
          'adobe': 'ADBE',
          'ibm': 'IBM',
          'cisco': 'CSCO',
          'mcdonald': 'MCD',
          'starbucks': 'SBUX',
          'home depot': 'HD',
          'target': 'TGT',
          'costco': 'COST',
          'uber': 'UBER',
          'lyft': 'LYFT',
          'airbnb': 'ABNB',
          'paypal': 'PYPL',
          'square': 'SQ',
          'zoom': 'ZM',
          'slack': 'WORK',
          'spotify': 'SPOT',
          'twitter': 'TWTR',
          'snap': 'SNAP',
          'pinterest': 'PINS',
          'roku': 'ROKU',
          'peloton': 'PTON',
          'robinhood': 'HOOD',
          'coinbase': 'COIN',
          'palantir': 'PLTR',
          'snowflake': 'SNOW',
          'databricks': 'DBRX',
        };

        // Check if the query matches a major stock
        let targetSymbol = null;
        
        // Direct symbol match (e.g., "AAPL")
        if (query.match(/^[A-Z]{1,5}$/i)) {
          targetSymbol = query.toUpperCase();
        }
        // Company name match
        else {
          for (const [name, symbol] of Object.entries(majorStockMap)) {
            if (name.includes(query) || query.includes(name)) {
              targetSymbol = symbol;
              break;
            }
          }
        }

        // If we found a known symbol, search directly
        if (targetSymbol) {
          const today = new Date();
          const horizon = new Date();
          horizon.setDate(today.getDate() + 120);

          const { data, error: fnError } = await supabase.functions.invoke('get-earnings', {
            body: {
              from: today.toISOString().split('T')[0],
              to: horizon.toISOString().split('T')[0],
              symbol: targetSymbol
            }
          });

          if (fnError) throw fnError;
          setFilteredEarnings((data as any)?.earningsCalendar || []);
          return;
        }

        // Fallback to database search for less common stocks
        const { data: stockMatches, error: searchError } = await (supabase
          .from('stocks') as any)
          .select('symbol, name, market_cap')
          .or(`symbol.ilike.%${query}%,name.ilike.%${query}%`)
          .not('market_cap', 'is', null) // Prioritize stocks with market cap data
          .order('market_cap', { ascending: false })
          .limit(5);

        if (searchError) throw searchError;

        if (stockMatches && stockMatches.length > 0) {
          // Use the best match (highest market cap)
          const symbol = stockMatches[0].symbol;
          const today = new Date();
          const horizon = new Date();
          horizon.setDate(today.getDate() + 120);

          const { data, error: fnError } = await supabase.functions.invoke('get-earnings', {
            body: {
              from: today.toISOString().split('T')[0],
              to: horizon.toISOString().split('T')[0],
              symbol
            }
          });

          if (fnError) throw fnError;
          setFilteredEarnings((data as any)?.earningsCalendar || []);
        } else {
          // No matches found
          setFilteredEarnings([]);
        }
      } catch (err) {
        console.error('Search error:', err);
        setFilteredEarnings([]);
      }
    };

    const debounceTimer = setTimeout(run, 300); // Debounce search
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, displayCount, earnings]);

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
    const date = new Date(dateString + 'T00:00:00'); // Ensure proper date parsing
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (hour: string) => {
    switch (hour?.toLowerCase()) {
      case 'bmo': return 'Before Market Open';
      case 'amc': return 'After Market Close';
      case 'dmh': return 'During Market Hours';
      default: return 'TBD';
    }
  };

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(1)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(1)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(1)}M`;
    return marketCap > 0 ? `$${marketCap.toLocaleString()}` : 'N/A';
  };

  const getMarketCapBadgeVariant = (marketCap: number) => {
    if (marketCap >= 100e9) return 'default'; // Large cap
    if (marketCap >= 10e9) return 'secondary'; // Mid cap
    return 'outline'; // Small cap
  };

  const groupEarningsByDate = (earningsData: EarningsData[]) => {
    const grouped = earningsData.reduce((acc, earning) => {
      const date = earning.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(earning);
      return acc;
    }, {} as Record<string, EarningsData[]>);

    // Sort each date group by market cap (largest first)
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
    });

    return grouped;
  };

  const groupedEarnings = groupEarningsByDate(filteredEarnings);
  const sortedDates = Object.keys(groupedEarnings).sort();

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">🗓 Earnings Calendar</h2>
      
      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by company (e.g. Apple, NVDA) or date (e.g. 2025-01-15, Jan 15)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-card"
        />
      </div>

      {/* Search Examples */}
      {searchQuery.length === 0 && (
        <div className="mb-4 text-xs text-muted-foreground flex flex-wrap gap-2">
          <span>Try searching:</span>
          <button 
            onClick={() => setSearchQuery('Apple')}
            className="bg-muted px-2 py-1 rounded hover:bg-muted/80"
          >
            Apple
          </button>
          <button 
            onClick={() => setSearchQuery('NVDA')}
            className="bg-muted px-2 py-1 rounded hover:bg-muted/80"
          >
            NVDA
          </button>
          <button 
            onClick={() => setSearchQuery('2025-01-15')}
            className="bg-muted px-2 py-1 rounded hover:bg-muted/80"
          >
            2025-01-15
          </button>
          <button 
            onClick={() => setSearchQuery('Jan 15')}
            className="bg-muted px-2 py-1 rounded hover:bg-muted/80"
          >
            Jan 15
          </button>
        </div>
      )}

      {/* Results Summary */}
      <div className="mb-4 text-sm text-muted-foreground">
        {searchQuery ? (
          searchQuery.match(/^\d{4}-\d{2}-\d{2}$/) || searchQuery.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) ? 
            `Showing ${filteredEarnings.length} earnings for ${searchQuery}` :
            `Showing ${filteredEarnings.length} earnings for "${searchQuery}"`
        ) : (
          `Showing ${filteredEarnings.length} upcoming earnings`
        )}
      </div>

      {/* Earnings by Date */}
      <div className="space-y-6">
        {sortedDates.map(date => (
          <div key={date}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4" />
              <h3 className="text-lg font-semibold">
                {formatDate(date)}
              </h3>
              <Badge variant="outline">
                {groupedEarnings[date].length} companies
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedEarnings[date].map((earning, index) => (
                <Card key={`${earning.symbol}-${date}-${index}`} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <span className="font-bold text-lg">{earning.symbol}</span>
                      {earning.market_cap > 0 && (
                        <Badge variant={getMarketCapBadgeVariant(earning.market_cap)}>
                          {formatMarketCap(earning.market_cap)}
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
                      <span>EPS Est: ${earning.epsEstimate?.toFixed(2) || 'N/A'}</span>
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

      {/* Load More Button */}
      {!searchQuery && filteredEarnings.length >= displayCount && earnings.length > displayCount && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setDisplayCount(prev => prev + 20)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Load More
          </button>
        </div>
      )}

      {filteredEarnings.length === 0 && !loading && (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {searchQuery ? `No earnings found for "${searchQuery}"` : 'No upcoming earnings found'}
          </p>
        </div>
      )}
    </section>
  );
};

export default EarningsCalendar;