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

  // Advanced search ranking algorithm optimized for financial search
  const calculateSearchScore = (stock: any, query: string): number => {
    const symbol = stock.symbol.toLowerCase();
    const name = stock.name.toLowerCase();
    const queryLower = query.toLowerCase().trim();
    
    if (!queryLower) return 0;
    
    // Enhanced market cap weighting with tiers
    const marketCap = stock.market_cap || 0;
    let marketCapMultiplier = 1;
    
    if (marketCap >= 1000000000000) { // Trillion+ (AAPL, MSFT, etc.)
      marketCapMultiplier = 10;
    } else if (marketCap >= 500000000000) { // 500B+ 
      marketCapMultiplier = 8;
    } else if (marketCap >= 100000000000) { // 100B+
      marketCapMultiplier = 6;
    } else if (marketCap >= 50000000000) { // 50B+
      marketCapMultiplier = 4;
    } else if (marketCap >= 10000000000) { // 10B+
      marketCapMultiplier = 2;
    }
    
    let score = 0;
    
    // TIER 1: Exact matches (highest priority)
    if (symbol === queryLower) {
      return 100000 * marketCapMultiplier;
    }
    
    // TIER 2: Perfect company name match
    if (name === queryLower) {
      return 90000 * marketCapMultiplier;
    }
    
    // TIER 3: Symbol prefix match (very important for stock symbols)
    if (symbol.startsWith(queryLower)) {
      score = 80000 * marketCapMultiplier;
    }
    
    // TIER 4: Company name prefix match (critical for brand searches like "apple")
    else if (name.startsWith(queryLower)) {
      score = 70000 * marketCapMultiplier;
    }
    
    // TIER 5: Word-level matches in company name
    else {
      const nameWords = name.split(/[\s,.-]+/).filter(word => word.length > 2);
      
      // Check for exact word matches at start of words
      const exactWordStart = nameWords.find(word => word.startsWith(queryLower));
      if (exactWordStart) {
        // Bonus for shorter matches (more precise)
        const lengthBonus = Math.max(0, 10 - queryLower.length) * 1000;
        score = (60000 + lengthBonus) * marketCapMultiplier;
      }
      
      // Check for exact word matches anywhere
      else if (nameWords.some(word => word === queryLower)) {
        score = 50000 * marketCapMultiplier;
      }
      
      // Check for word contains (substring matches)
      else if (nameWords.some(word => word.includes(queryLower))) {
        score = 40000 * marketCapMultiplier;
      }
      
      // Symbol contains query
      else if (symbol.includes(queryLower)) {
        score = 30000 * marketCapMultiplier;
      }
      
      // Fuzzy matching for common abbreviations and misspellings
      else {
        // Handle common company type abbreviations
        const companyTypeMap: Record<string, string[]> = {
          'corp': ['corporation', 'corp.', 'inc', 'incorporated'],
          'tech': ['technology', 'technologies'],
          'sys': ['systems', 'system'],
          'group': ['grp', 'group'],
          'company': ['co', 'co.', 'company'],
        };
        
        let fuzzyScore = 0;
        const fullText = `${symbol} ${name}`;
        
        // Check for abbreviation matches
        Object.entries(companyTypeMap).forEach(([short, variations]) => {
          if (queryLower.includes(short) || variations.some(v => queryLower.includes(v))) {
            if (variations.some(v => fullText.includes(v)) || fullText.includes(short)) {
              fuzzyScore += 5000;
            }
          }
        });
        
        // General substring match with penalty for length
        if (fullText.includes(queryLower)) {
          fuzzyScore += Math.max(1000, 10000 - queryLower.length * 100);
        }
        
        score = fuzzyScore * marketCapMultiplier;
      }
    }
    
    // Additional bonuses
    
    // Length proximity bonus (favor shorter, more precise matches)
    if (score > 0) {
      const queryLength = queryLower.length;
      const symbolLength = symbol.length;
      const nameLength = name.length;
      
      // Bonus for query length matching symbol length (indicates ticker search)
      if (queryLength <= 5 && Math.abs(queryLength - symbolLength) <= 1) {
        score *= 1.2;
      }
      
      // Penalty for very long company names when query is short
      if (queryLength <= 4 && nameLength > 20) {
        score *= 0.8;
      }
    }
    
    // Exchange preference (NASDAQ/NYSE over OTC)
    if (score > 0 && (stock.exchange === 'NASDAQ' || stock.exchange === 'NYSE')) {
      score *= 1.1;
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