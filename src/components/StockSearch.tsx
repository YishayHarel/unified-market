import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  market_cap?: number;
  score?: number;
}

const StockSearch = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Enhanced search algorithm similar to Robinhood
  const calculateSearchScore = (stock: any, query: string): number => {
    const symbol = stock.symbol.toLowerCase();
    const name = stock.name.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Stronger market cap weighting for large companies
    const marketCap = stock.market_cap || 0;
    const marketCapWeight = marketCap > 0 ? Math.log(marketCap) * 5 : 0;
    
    let score = 0;
    
    // Exact symbol match (highest priority)
    if (symbol === queryLower) {
      score += 10000 + marketCapWeight;
      return score;
    }
    
    // Exact company name match (very high priority)
    if (name === queryLower) {
      score += 9000 + marketCapWeight;
      return score;
    }
    
    // Company name starts with query (prioritize large companies heavily)
    if (name.startsWith(queryLower)) {
      score += 8000 + marketCapWeight * 2;
    }
    
    // Symbol starts with query
    else if (symbol.startsWith(queryLower)) {
      score += 7000 + marketCapWeight;
    }
    
    // Company name word starts with query (for multi-word names)
    const nameWords = name.split(/[\s,.-]+/).filter(word => word.length > 0);
    const exactWordMatch = nameWords.some(word => word.startsWith(queryLower));
    if (exactWordMatch && !name.startsWith(queryLower)) {
      score += 6000 + marketCapWeight * 1.5;
    }
    
    // Symbol contains query
    else if (symbol.includes(queryLower)) {
      score += 4000 + marketCapWeight * 0.5;
    }
    
    // Company name contains query
    else if (name.includes(queryLower)) {
      score += 3000 + marketCapWeight * 0.5;
    }
    
    // Partial word matches with higher weight for larger companies
    const partialMatches = nameWords.filter(word => 
      word.includes(queryLower) && word !== queryLower
    ).length;
    score += partialMatches * (500 + marketCapWeight * 0.2);
    
    // Extra boost for very large companies (market cap > 100B)
    if (marketCap > 100000000000) {
      score += 1000;
    }
    
    return Math.max(score, 0);
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (query: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => handleSearch(query), 150);
      };
    })(),
    []
  );

  // Enhanced search function with smart ranking
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      // Fetch a broader set of results for better ranking
      const { data: stocks, error } = await supabase
        .from('stocks')
        .select('symbol, name, exchange, market_cap')
        .or(`symbol.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(50); // Get more results to rank properly

      if (error) throw error;

      // Apply smart ranking algorithm
      const rankedResults = (stocks || [])
        .map(stock => ({
          ...stock,
          score: calculateSearchScore(stock, query.toLowerCase())
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8); // Show top 8 results

      setResults(rankedResults);
    } catch (error) {
      console.error('Error searching stocks:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">🔍 Stock Search</h2>
      
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search stocks by symbol or company name..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            debouncedSearch(e.target.value);
          }}
          className="pl-10 bg-card"
        />
      </div>

      {isSearching && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground mt-2">Searching...</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((stock) => (
            <div
              key={stock.symbol}
              className="bg-card p-4 rounded-lg flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => navigate(`/stock/${stock.symbol}`)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-bold">{stock.symbol.charAt(0)}</span>
                </div>
                <div>
                  <div className="font-semibold">{stock.symbol}</div>
                  <div className="text-sm text-muted-foreground">{stock.name}</div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm text-muted-foreground">{stock.exchange}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {searchQuery && !isSearching && results.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            No stocks found for "{searchQuery}"
          </p>
        </div>
      )}
    </section>
  );
};

export default StockSearch;