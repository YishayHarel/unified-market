import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Search, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStockPrices } from "@/hooks/useStockPrices";

interface SavedStock {
  id: string;
  symbol: string;
  name: string;
  saved_at: string;
}

const UserSavedStocks = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [savedStocks, setSavedStocks] = useState<SavedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchSymbol, setSearchSymbol] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSavedStocks();
    }
  }, [user]);

  const fetchSavedStocks = async () => {
    try {
      const { data, error } = await (supabase
        .from("user_saved_stocks") as any)
        .select("*")
        .order("saved_at", { ascending: false });

      if (error) throw error;
      setSavedStocks(data || []);
    } catch (error) {
      console.error("Error fetching saved stocks:", error);
      toast({
        title: "Error",
        description: "Failed to load saved stocks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Smart price fetching - only fetch prices for saved stocks
  const symbolsToFetch = useMemo(() => savedStocks.map(s => s.symbol), [savedStocks]);
  const { prices, loading: pricesLoading } = useStockPrices(symbolsToFetch);

  const addStock = async () => {
    if (!searchSymbol.trim()) return;
    
    setAdding(true);
    try {
      const { error } = await (supabase
        .from("user_saved_stocks") as any)
        .insert({
          user_id: user!.id,
          symbol: searchSymbol.toUpperCase(),
          name: searchSymbol.toUpperCase(),
        });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Already saved",
            description: "This stock is already in your saved list",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Stock added",
          description: `${searchSymbol.toUpperCase()} has been saved to your list`,
        });
        setSearchSymbol("");
        fetchSavedStocks();
      }
    } catch (error) {
      console.error("Error adding stock:", error);
      toast({
        title: "Error",
        description: "Failed to add stock",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const removeStock = async (e: React.MouseEvent, stockId: string, symbol: string) => {
    e.stopPropagation();
    try {
      const { error } = await (supabase
        .from("user_saved_stocks") as any)
        .delete()
        .eq("id", stockId);

      if (error) throw error;

      toast({
        title: "Stock removed",
        description: `${symbol} has been removed from your list`,
      });
      fetchSavedStocks();
    } catch (error) {
      console.error("Error removing stock:", error);
      toast({
        title: "Error",
        description: "Failed to remove stock",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Saved Stocks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          My Saved Stocks ({savedStocks.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter stock symbol (e.g., AAPL)"
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addStock()}
          />
          <Button onClick={addStock} disabled={adding || !searchSymbol.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {savedStocks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No saved stocks yet</p>
            <p className="text-sm">Add some stocks to track them easily</p>
          </div>
        ) : (
          <div className="space-y-2">
            {savedStocks.map((stock) => {
              const priceData = prices.get(stock.symbol);
              const hasPrice = priceData && priceData.price > 0;
              const isPositive = priceData && priceData.changePercent >= 0;

              return (
                <div
                  key={stock.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => navigate(`/stock/${stock.symbol}`)}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">
                      {stock.symbol}
                    </Badge>
                    {hasPrice ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">${priceData.price.toFixed(2)}</span>
                        <span className={`flex items-center text-sm ${isPositive ? 'text-primary' : 'text-destructive'}`}>
                          {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                          {isPositive ? '+' : ''}{priceData.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    ) : pricesLoading ? (
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Saved {new Date(stock.saved_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => removeStock(e, stock.id, stock.symbol)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserSavedStocks;
