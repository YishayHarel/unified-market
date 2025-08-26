import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, Star, Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StockChart from "@/components/StockChart";
import StockFundamentals from "@/components/StockFundamentals";
import StockNews from "@/components/StockNews";
import AnalystRatings from "@/components/AnalystRatings";

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
  marketCap: string;
  peRatio: number;
  dividendYield: number;
  weekHigh52: number;
  weekLow52: number;
}

const StockDetail = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("1D");

  const periods = ["1D", "1W", "1M", "3M", "1Y", "5Y"];

  useEffect(() => {
    if (!symbol) return;

    // Mock data - replace with real API call
    const mockData: StockData = {
      symbol: symbol.toUpperCase(),
      name: getCompanyName(symbol),
      price: 175.43,
      change: 2.15,
      changePercent: 1.24,
      high: 177.23,
      low: 173.85,
      open: 174.20,
      volume: 45623789,
      marketCap: "2.8T",
      peRatio: 28.5,
      dividendYield: 0.52,
      weekHigh52: 198.23,
      weekLow52: 164.08
    };

    setTimeout(() => {
      setStockData(mockData);
      setLoading(false);
    }, 800);
  }, [symbol]);

  const getCompanyName = (symbol: string) => {
    const companies: Record<string, string> = {
      AAPL: "Apple Inc.",
      GOOGL: "Alphabet Inc.",
      MSFT: "Microsoft Corporation",
      TSLA: "Tesla Inc.",
      AMZN: "Amazon.com Inc.",
      NVDA: "NVIDIA Corporation"
    };
    return companies[symbol.toUpperCase()] || `${symbol.toUpperCase()} Inc.`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-card rounded w-48"></div>
            <div className="h-32 bg-card rounded"></div>
            <div className="h-64 bg-card rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stockData) {
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

  const isPositive = stockData.change >= 0;

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
                <span className="text-lg font-bold">{stockData.symbol.charAt(0)}</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">{stockData.symbol}</h1>
                <p className="text-sm text-muted-foreground">{stockData.name}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              Watch
            </Button>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Buy
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Price Section */}
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-3xl font-bold mb-1">
                  ${stockData.price.toFixed(2)}
                </div>
                <div className={`flex items-center gap-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="font-medium">
                    {isPositive ? '+' : ''}{stockData.change.toFixed(2)} ({stockData.changePercent.toFixed(2)}%)
                  </span>
                  <span className="text-muted-foreground text-sm">Today</span>
                </div>
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
              <StockChart symbol={stockData.symbol} period={selectedPeriod} />
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Fundamentals & Analyst Ratings */}
          <div className="lg:col-span-1 space-y-6">
            <StockFundamentals stockData={stockData} />
            <AnalystRatings symbol={stockData.symbol} />
          </div>

          {/* Right Column - News */}
          <div className="lg:col-span-2">
            <StockNews symbol={stockData.symbol} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockDetail;