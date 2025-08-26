import { useState } from "react";
import { Search, TrendingUp, Plus, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  exchange: string;
}

const StockSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Mock search function
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    // Mock search results
    const mockResults: SearchResult[] = [
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        price: 175.43,
        change: 2.15,
        changePercent: 1.24,
        exchange: "NASDAQ"
      },
      {
        symbol: "AMZN",
        name: "Amazon.com Inc.",
        price: 153.92,
        change: -1.87,
        changePercent: -1.20,
        exchange: "NASDAQ"
      },
      {
        symbol: "GOOGL",
        name: "Alphabet Inc Class A",
        price: 142.56,
        change: 0.89,
        changePercent: 0.63,
        exchange: "NASDAQ"
      }
    ].filter(stock => 
      stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
      stock.name.toLowerCase().includes(query.toLowerCase())
    );

    setTimeout(() => {
      setResults(mockResults);
      setIsSearching(false);
    }, 500);
  };

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-accent/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Stock Search
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search stocks by symbol or company name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSearch(e.target.value);
            }}
            className="pl-10 bg-background/50"
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
                className="flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-background to-muted/20 hover:from-muted/30 hover:to-muted/40 transition-all duration-200"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {stock.symbol.charAt(0)}
                    </span>
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{stock.symbol}</p>
                      <Badge variant="outline" className="text-xs">
                        {stock.exchange}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {stock.name}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-foreground">
                      ${stock.price.toFixed(2)}
                    </p>
                    <div className="flex items-center gap-1 justify-end">
                      {stock.change >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-primary" />
                      ) : (
                        <TrendingUp className="h-3 w-3 text-destructive rotate-180" />
                      )}
                      <span
                        className={`text-xs ${
                          stock.change >= 0 ? "text-primary" : "text-destructive"
                        }`}
                      >
                        {stock.change >= 0 ? "+" : ""}
                        {stock.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-3">
                  <Button size="icon" variant="ghost" className="h-8 w-8">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {searchQuery && !isSearching && results.length === 0 && (
          <div className="text-center py-8">
            <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No stocks found for "{searchQuery}"
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StockSearch;