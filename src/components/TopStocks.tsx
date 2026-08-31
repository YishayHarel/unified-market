import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface TopStock {
  id: number;
  symbol: string;
  name: string;
  market_cap: number | null;
  rank_score: number | null;
  last_return_1d: number | null;
  last_ranked_at: string | null;
}

export const TopStocks = () => {
  const [stocks, setStocks] = useState<TopStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(20);
  const navigate = useNavigate();

  const fetchTopStocks = async () => {
    try {
      const { data, error } = await supabase
        .from('stocks')
        .select('id, symbol, name, market_cap, rank_score, last_return_1d, last_ranked_at')
        .eq('is_top_100', true)
        // nullsFirst matters: 58 of the 60 rows had no score at all, so
        // ordering by it put the list in effectively arbitrary order.
        .order('rank_score', { ascending: false, nullsFirst: false })
        .order('market_cap', { ascending: false, nullsFirst: false })
        .limit(100); // Fetch all top 100

      if (error) throw error;
      
      setStocks(data || []);
    } catch (error) {
      console.error('Error fetching top stocks:', error);
      toast.error('Failed to load top stocks');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    setDisplayCount(prev => Math.min(prev + 20, stocks.length));
  };

  useEffect(() => {
    fetchTopStocks();
  }, []);

  const formatMarketCap = (marketCap: number | null) => {
    if (!marketCap) return 'N/A';
    
    if (marketCap >= 1e12) {
      return `$${(marketCap / 1e12).toFixed(1)}T`;
    } else if (marketCap >= 1e9) {
      return `$${(marketCap / 1e9).toFixed(1)}B`;
    } else if (marketCap >= 1e6) {
      return `$${(marketCap / 1e6).toFixed(1)}M`;
    }
    return `$${marketCap.toLocaleString()}`;
  };

  const formatPercentage = (value: number | null) => {
    if (value === null) return 'N/A';
    const formatted = (value * 100).toFixed(2);
    return `${value >= 0 ? '+' : ''}${formatted}%`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top 100 Stocks</CardTitle>
          <CardDescription>Market leaders and trending stocks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {/*
        The "Update Rankings" button that used to sit here called a function
        gated on the scheduler's secret, so for every visitor it returned 401
        and toasted "Failed to update rankings". The rankings are rebuilt after
        each close on their own.
      */}
      <CardHeader className="pb-4">
        <CardTitle>Top 100 Stocks</CardTitle>
        <CardDescription>
          Scored out of 10, mostly on company size with weight given to how much the stock is
          moving today.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stocks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Rankings are not available right now. They are rebuilt after each market close.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {stocks.slice(0, displayCount).map((stock, index) => (
              <div
                key={stock.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/stock/${stock.symbol}`)}
              >
                <div className="flex items-center space-x-4">
                  <Badge variant="secondary" className="w-8 h-8 flex items-center justify-center rounded-full text-xs font-semibold">
                    {index + 1}
                  </Badge>
                  <div>
                    <h3 className="font-semibold text-foreground">{stock.symbol}</h3>
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {stock.name}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6 text-right">
                  <div>
                    <p className="text-sm font-medium">Market Cap</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMarketCap(stock.market_cap)}
                    </p>
                  </div>
                  
                  {stock.last_return_1d !== null && (
                    <div className="flex items-center space-x-1">
                      {stock.last_return_1d >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <span className={`text-sm font-medium ${
                        stock.last_return_1d >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {formatPercentage(stock.last_return_1d)}
                      </span>
                    </div>
                  )}
                  
                  {stock.rank_score !== null && stock.rank_score !== undefined && (
                    <div>
                      <p className="text-sm font-medium">Score</p>
                      <p className="text-xs text-muted-foreground">
                        {stock.rank_score.toFixed(1)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {displayCount < stocks.length && (
              <div className="flex justify-center mt-6">
                <Button 
                  onClick={loadMore}
                  variant="outline"
                  className="w-full max-w-xs"
                >
                  Load More ({Math.min(20, stocks.length - displayCount)} of {stocks.length - displayCount} remaining)
                </Button>
              </div>
            )}
            
            <div className="mt-6 pt-4 border-t">
              <p className="text-xs text-muted-foreground text-center">
                {stocks[0]?.last_ranked_at && (
                  <>Last updated: {new Date(stocks[0].last_ranked_at).toLocaleDateString()}</>
                )}
                {stocks.length > 0 && (
                  <> • Showing {displayCount} of {stocks.length} stocks</>
                )}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};