import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

const StockSearch = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Real search function using Supabase
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const { data: stocks, error } = await supabase
        .from('stocks')
        .select('symbol, name, exchange')
        .or(`symbol.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;

      setResults(stocks || []);
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
            handleSearch(e.target.value);
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