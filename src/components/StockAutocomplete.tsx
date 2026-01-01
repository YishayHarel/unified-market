import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface StockResult {
  symbol: string;
  name: string;
  exchange: string;
  market_cap?: number;
  score?: number;
}

interface StockAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (stock: StockResult) => void;
  placeholder?: string;
  className?: string;
  showIcon?: boolean;
}

const StockAutocomplete = ({
  value,
  onChange,
  onSelect,
  placeholder = "Search stocks...",
  className,
  showIcon = true,
}: StockAutocompleteProps) => {
  const [results, setResults] = useState<StockResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Advanced search ranking algorithm optimized for financial search
  const calculateSearchScore = (stock: any, query: string): number => {
    const symbol = stock.symbol.toLowerCase();
    const name = stock.name.toLowerCase();
    const queryLower = query.toLowerCase().trim();

    if (!queryLower) return 0;

    // Enhanced market cap weighting with tiers
    const marketCap = stock.market_cap || 0;
    let marketCapMultiplier = 1;

    if (marketCap >= 1000000000000) marketCapMultiplier = 10;
    else if (marketCap >= 500000000000) marketCapMultiplier = 8;
    else if (marketCap >= 100000000000) marketCapMultiplier = 6;
    else if (marketCap >= 50000000000) marketCapMultiplier = 4;
    else if (marketCap >= 10000000000) marketCapMultiplier = 2;

    // Exact symbol match
    if (symbol === queryLower) return 100000 * marketCapMultiplier;
    
    // Exact name match
    if (name === queryLower) return 90000 * marketCapMultiplier;
    
    // Symbol prefix match
    if (symbol.startsWith(queryLower)) return 80000 * marketCapMultiplier;
    
    // Name prefix match
    if (name.startsWith(queryLower)) return 70000 * marketCapMultiplier;

    // Word-level matches
    const nameWords = name.split(/[\s,.-]+/).filter((word) => word.length > 2);
    const exactWordStart = nameWords.find((word) => word.startsWith(queryLower));
    if (exactWordStart) {
      const lengthBonus = Math.max(0, 10 - queryLower.length) * 1000;
      return (60000 + lengthBonus) * marketCapMultiplier;
    }

    if (nameWords.some((word) => word === queryLower)) {
      return 50000 * marketCapMultiplier;
    }

    if (nameWords.some((word) => word.includes(queryLower))) {
      return 40000 * marketCapMultiplier;
    }

    if (symbol.includes(queryLower)) {
      return 30000 * marketCapMultiplier;
    }

    // General substring match
    const fullText = `${symbol} ${name}`;
    if (fullText.includes(queryLower)) {
      return Math.max(1000, 10000 - queryLower.length * 100) * marketCapMultiplier;
    }

    return 0;
  };

  // Debounced search function
  const searchStocks = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);

    try {
      const { data: stocks, error } = await (supabase.from("stocks") as any)
        .select("symbol, name, exchange, market_cap")
        .or(`symbol.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(50);

      if (error) throw error;

      const rankedResults = (stocks || [])
        .map((stock: any) => ({
          ...stock,
          score: calculateSearchScore(stock, query.toLowerCase()),
        }))
        .filter((s: StockResult) => (s.score || 0) > 0)
        .sort((a: StockResult, b: StockResult) => (b.score || 0) - (a.score || 0))
        .slice(0, 8);

      setResults(rankedResults);
      setIsOpen(rankedResults.length > 0);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error("Error searching stocks:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce the search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchStocks(value);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [value, searchStocks]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          handleSelect(results[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleSelect = (stock: StockResult) => {
    onChange(stock.symbol);
    onSelect(stock);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const formatMarketCap = (marketCap: number | undefined) => {
    if (!marketCap) return "";
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(1)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(1)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(1)}M`;
    return `$${marketCap.toLocaleString()}`;
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        {showIcon && (
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className={cn(showIcon && "pl-10", "bg-card border border-border")}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <ul className="max-h-64 overflow-auto py-1">
            {results.map((stock, index) => (
              <li
                key={stock.symbol}
                className={cn(
                  "px-3 py-2 cursor-pointer flex items-center justify-between transition-colors",
                  index === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50"
                )}
                onClick={() => handleSelect(stock)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold">
                      {stock.symbol.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{stock.symbol}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {stock.name}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="text-xs text-muted-foreground">
                    {stock.exchange}
                  </div>
                  {stock.market_cap && (
                    <div className="text-xs font-medium text-primary">
                      {formatMarketCap(stock.market_cap)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default StockAutocomplete;
