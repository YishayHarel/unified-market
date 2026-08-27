import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, Star, Eye, Plus, Check, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StockChart from "@/components/StockChart";
import StockFundamentals from "@/components/StockFundamentals";
import StockNews from "@/components/StockNews";
import AnalystRatings from "@/components/AnalystRatings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  avgVolume: number;
  marketCap: string;
  peRatio: number;
  dividendYield: number;
  weekHigh52: number;
  weekLow52: number;
}

const StockDetail = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("1D");
  const [isWatched, setIsWatched] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);

  const periods = ["1H", "1D", "1W", "1M", "3M", "1Y", "MAX"];

  // Check if stock is already in user's saved stocks
  useEffect(() => {
    const checkWatchStatus = async () => {
      if (!user || !symbol) return;
      
      const { data } = await (supabase
        .from('user_saved_stocks') as any)
        .select('id')
        .eq('user_id', user.id)
        .eq('symbol', symbol.toUpperCase())
        .maybeSingle();
      
      setIsWatched(!!data);
    };
    
    checkWatchStatus();
  }, [user, symbol]);

  // Handle Watch button click
  const handleWatch = async () => {
    if (!user) {
      toast.error('Please sign in to add stocks to your watchlist');
      navigate('/auth');
      return;
    }
    
    if (!symbol) return;
    
    setWatchLoading(true);
    try {
      if (isWatched) {
        // Remove from watchlist
        const { error } = await (supabase
          .from('user_saved_stocks') as any)
          .delete()
          .eq('user_id', user.id)
          .eq('symbol', symbol.toUpperCase());
        
        if (error) throw error;
        setIsWatched(false);
        toast.success(`${symbol.toUpperCase()} removed from watchlist`);
      } else {
        // Add to watchlist
        const { error } = await (supabase
          .from('user_saved_stocks') as any)
          .insert({
            user_id: user.id,
            symbol: symbol.toUpperCase(),
            name: stockData?.name || symbol.toUpperCase()
          });
        
        if (error) throw error;
        setIsWatched(true);
        toast.success(`${symbol.toUpperCase()} added to watchlist`);
      }
    } catch (error) {
      console.error('Error updating watchlist:', error);
      toast.error('Failed to update watchlist');
    } finally {
      setWatchLoading(false);
    }
  };

  // Handle Buy button click
  const handleBuy = () => {
    toast.info('Trading functionality coming soon! Connect your brokerage to enable trading.');
  };

  // Handle Discuss button click - create or navigate to stock channel
  const handleDiscuss = async () => {
    if (!symbol || !stockData) return;
    
    try {
      // Check if channel already exists
      const { data: existingChannel } = await supabase
        .from('discussion_channels')
        .select('id')
        .eq('symbol', symbol.toUpperCase())
        .maybeSingle();
      
      if (existingChannel) {
        // Navigate to discussions with this channel
        navigate(`/discussions?channel=${existingChannel.id}`);
      } else {
        // Create new stock channel
        const { data: newChannel, error } = await supabase
          .from('discussion_channels')
          .insert({
            name: symbol.toUpperCase(),
            description: `Discussion about ${stockData.name} (${symbol.toUpperCase()})`,
            channel_type: 'stock',
            symbol: symbol.toUpperCase()
          })
          .select('id')
          .single();
        
        if (error) throw error;
        
        toast.success(`Created discussion channel for ${symbol.toUpperCase()}`);
        navigate(`/discussions?channel=${newChannel.id}`);
      }
    } catch (error) {
      console.error('Error creating stock channel:', error);
      toast.error('Failed to open discussion');
    }
  };

  useEffect(() => {
    if (!symbol) return;
    
    const fetchStockData = async () => {
      try {
        setLoading(true);
        
        // First, get basic stock info from database
        const { data: stockInfo, error: stockError } = await (supabase
          .from('stocks') as any)
          .select('symbol, name, market_cap')
          .eq('symbol', symbol.toUpperCase())
          .maybeSingle();
        
        if (stockError && stockError.code !== 'PGRST116') {
          console.error('Error fetching stock info:', stockError);
        }
        
        // Then get real-time price data and fundamentals
        console.log('Fetching data for:', symbol.toUpperCase());
        
        const [priceResponse, fundamentalsResponse] = await Promise.allSettled([
          supabase.functions.invoke('get-stock-prices', {
            body: { symbols: [symbol.toUpperCase()] }
          }),
          supabase.functions.invoke('get-stock-fundamentals', {
            body: { symbol: symbol.toUpperCase() }
          })
        ]);
        
        console.log('Price response:', priceResponse);
        console.log('Fundamentals response:', fundamentalsResponse);
        
        // Handle price data
        let priceData = null;
        if (priceResponse.status === 'fulfilled' && !priceResponse.value.error) {
          priceData = priceResponse.value.data;
        } else {
          console.error('Error fetching price data:', priceResponse);
          toast.error('Failed to load stock price data');
        }
        
        // Handle fundamentals data (don't fail if this doesn't work)
        let fundamentalsData: any = {};
        if (fundamentalsResponse.status === 'fulfilled' && !fundamentalsResponse.value.error) {
          fundamentalsData = fundamentalsResponse.value.data || {};
        } else {
          console.error('Error fetching fundamentals data:', fundamentalsResponse);
          // Don't show error toast for fundamentals as it's nice-to-have
        }
        
        // Combine the data
        let stockData: StockData;
        
        if (priceData && priceData.length > 0) {
          const price = priceData[0];
          
          console.log('Using price data:', price);
          console.log('Using fundamentals data:', fundamentalsData);
          
          // Finnhub returns market cap in millions, so multiply by 1M
          const marketCapValue = fundamentalsData.marketCapitalization 
            ? fundamentalsData.marketCapitalization * 1000000 
            : (stockInfo?.market_cap || null);
          
          stockData = {
            symbol: symbol.toUpperCase(),
            name: stockInfo?.name || getCompanyName(symbol),
            price: price.price || 0,
            change: price.change || 0,
            changePercent: price.changePercent || 0,
            high: price.high || price.price || 0,
            low: price.low || price.price || 0,
            open: price.open || price.price || 0,
            volume: price.volume || 0,
            avgVolume: price.avgVolume || 0,
            marketCap: formatMarketCap(marketCapValue),
            peRatio: fundamentalsData.peRatio || 0,
            dividendYield: fundamentalsData.dividendYield || 0,  
            weekHigh52: fundamentalsData.week52High || 0,
            weekLow52: fundamentalsData.week52Low || 0
          };
        } else {
          // Fallback data if API fails
          console.log('No price data, using fallback with fundamentals:', fundamentalsData);
          
          // Finnhub returns market cap in millions
          const marketCapValue = fundamentalsData.marketCapitalization 
            ? fundamentalsData.marketCapitalization * 1000000 
            : (stockInfo?.market_cap || null);
          
          stockData = {
            symbol: symbol.toUpperCase(),
            name: stockInfo?.name || getCompanyName(symbol),
            price: 0,
            change: 0,
            changePercent: 0,
            high: 0,
            low: 0,
            open: 0,
            volume: 0,
            avgVolume: 0,
            marketCap: formatMarketCap(marketCapValue),
            peRatio: fundamentalsData.peRatio || 0,
            dividendYield: fundamentalsData.dividendYield || 0,
            weekHigh52: fundamentalsData.week52High || 0,
            weekLow52: fundamentalsData.week52Low || 0
          };
        }
        
        setStockData(stockData);
      } catch (error) {
        console.error('Error in fetchStockData:', error);
        toast.error('Failed to load stock data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStockData();
  }, [symbol]);
  
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

  const getCompanyName = (symbol: string) => {
    const companies: Record<string, string> = {
      AAPL: "Apple Inc.",
      GOOGL: "Alphabet Inc.",
      MSFT: "Microsoft Corporation", 
      TSLA: "Tesla Inc.",
      AMZN: "Amazon.com Inc.",
      NVDA: "NVIDIA Corporation",
      CL: "Colgate-Palmolive Company"
    };
    return companies[symbol.toUpperCase()] || `${symbol.toUpperCase()} Inc.`;
  };

  if (!symbol) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Stock not found</h1>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isLoading = loading || !stockData;
  const displaySymbol = symbol.toUpperCase();
  const displayName = stockData?.name || "Loading...";
  const displayPrice = stockData?.price ?? 0;
  const displayChange = stockData?.change ?? 0;
  const displayChangePercent = stockData?.changePercent ?? 0;
  const isPositive = displayChange >= 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border p-4 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="hover:bg-card"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-card flex items-center justify-center">
                <span className="text-lg font-bold">{displaySymbol.charAt(0)}</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">{displaySymbol}</h1>
                <p className="text-sm text-muted-foreground">{displayName}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant={isWatched ? "default" : "outline"} 
              size="sm"
              onClick={handleWatch}
              disabled={watchLoading}
            >
              {isWatched ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              {isWatched ? 'Watching' : 'Watch'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDiscuss} disabled={isLoading}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Discuss
            </Button>
            <Button size="sm" onClick={handleBuy} disabled={isLoading}>
              <Plus className="w-4 h-4 mr-2" />
              Buy
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
        {/* Price Section */}
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                {isLoading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-8 w-40 bg-card rounded" />
                    <div className="h-4 w-60 bg-card rounded" />
                  </div>
                ) : (
                  <>
                    <div className="text-3xl font-bold mb-1">
                      ${displayPrice.toFixed(2)}
                    </div>
                    <div className={`flex items-center gap-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isPositive ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span className="font-medium">
                        {isPositive ? '+' : ''}{displayChange.toFixed(2)} ({displayChangePercent.toFixed(2)}%)
                      </span>
                      <span className="text-muted-foreground text-sm">At close · 4:00 PM ET</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2 mb-4">
              {periods.map((period) => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedPeriod(period)}
                  className="h-8 px-3"
                >
                  {period}
                </Button>
              ))}
            </div>

            {/* Chart */}
            <div className="h-64">
              <StockChart 
                symbol={displaySymbol} 
                period={selectedPeriod}
                currentPrice={displayPrice}
                dayChange={displayChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        {stockData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Open</div>
                <div className="font-semibold">${stockData.open.toFixed(2)}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">High</div>
                <div className="font-semibold">${stockData.high.toFixed(2)}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Low</div>
                <div className="font-semibold">${stockData.low.toFixed(2)}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Volume</div>
                <div className="font-semibold">{(stockData.volume / 1000000).toFixed(1)}M</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Grid */}
        {stockData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Fundamentals & Analyst Ratings */}
            <div className="lg:col-span-1 space-y-6">
              <StockFundamentals stockData={stockData} />
              <AnalystRatings symbol={stockData.symbol} />
            </div>

            {/* Right Column - News */}
            <div className="lg:col-span-2">
              <StockNews symbol={stockData.symbol} companyName={stockData.name} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockDetail;