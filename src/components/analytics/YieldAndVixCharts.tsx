import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { TrendingUp, TrendingDown, RefreshCw, Loader2, BarChart3, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ChartData {
  date: string;
  value: number;
}

interface SymbolData {
  symbol: string;
  name: string;
  data: ChartData[];
  currentPrice: number;
  change: number;
  changePercent: number;
}

const chartColors = {
  vix: "hsl(var(--chart-vix))",
  twoYear: "hsl(var(--chart-2y))",
  tenYear: "hsl(var(--chart-10y))",
};

const YieldAndVixCharts = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vixData, setVixData] = useState<SymbolData | null>(null);
  const [twoYearData, setTwoYearData] = useState<SymbolData | null>(null);
  const [tenYearData, setTenYearData] = useState<SymbolData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("1M");

  const fetchChartData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch data for VIX proxy (UVXY), 2Y Treasury proxy (SHY), and 10Y Treasury proxy (IEF)
      const symbols = [
        { symbol: "UVXY", name: "VIX Volatility Index (UVXY Proxy)" },
        { symbol: "SHY", name: "2-Year Treasury Yield (SHY Proxy)" },
        { symbol: "IEF", name: "10-Year Treasury Yield (IEF Proxy)" },
      ];

      const results = await Promise.all(
        symbols.map(async ({ symbol, name }) => {
          const { data, error } = await supabase.functions.invoke("get-stock-candles", {
            body: { symbol, period: selectedPeriod, includeIndicators: false },
          });

          if (error || !data?.candles?.length) {
            console.error(`Error fetching ${symbol}:`, error);
            return null;
          }

          const candles = data.candles;
          const chartData: ChartData[] = candles.map((c: any) => ({
            date: new Date(c.timestamp).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            value: c.close,
          }));

          const firstPrice = candles[0]?.close || 0;
          const lastPrice = candles[candles.length - 1]?.close || 0;
          const change = lastPrice - firstPrice;
          const changePercent = firstPrice > 0 ? (change / firstPrice) * 100 : 0;

          return {
            symbol,
            name,
            data: chartData,
            currentPrice: lastPrice,
            change,
            changePercent,
          };
        })
      );

      setVixData(results[0]);
      setTwoYearData(results[1]);
      setTenYearData(results[2]);
    } catch (err) {
      console.error("Error fetching chart data:", err);
      setError("Failed to load chart data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, [selectedPeriod]);

  const renderChart = (data: SymbolData | null, color: string, isVix: boolean = false) => {
    if (!data) {
      return (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          No data available
        </div>
      );
    }

    const isPositive = data.changePercent >= 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">${data.currentPrice.toFixed(2)}</div>
            <div className={`flex items-center gap-1 text-sm ${isPositive ? "text-primary" : "text-destructive"}`}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>
                {isPositive ? "+" : ""}
                {data.change.toFixed(2)} ({data.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {data.symbol}
          </Badge>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data.data}>
            <defs>
              <linearGradient id={`gradient-${data.symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${data.symbol})`}
            />
          </AreaChart>
        </ResponsiveContainer>

        {isVix && (
          <div className="text-xs text-muted-foreground">
            UVXY tracks 1.5x the daily VIX short-term futures index
          </div>
        )}
        {!isVix && (
          <div className="text-xs text-muted-foreground">
            ETF price moves inversely to yield - higher prices = lower yields
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Charts...
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Fetching historical data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Yield & VIX Charts
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchChartData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Treasury Yields & Volatility
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-primary border-primary">
            Live Data
          </Badge>
          <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <TabsList className="h-8">
              <TabsTrigger value="1W" className="text-xs px-2">1W</TabsTrigger>
              <TabsTrigger value="1M" className="text-xs px-2">1M</TabsTrigger>
              <TabsTrigger value="3M" className="text-xs px-2">3M</TabsTrigger>
              <TabsTrigger value="1Y" className="text-xs px-2">1Y</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="sm" onClick={fetchChartData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* VIX Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" style={{ color: chartColors.vix }} />
            VIX Volatility Index
          </CardTitle>
        </CardHeader>
        <CardContent>{renderChart(vixData, chartColors.vix, true)}</CardContent>
      </Card>

      {/* Treasury Yield Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: chartColors.twoYear }} />
              2-Year Treasury (SHY)
            </CardTitle>
          </CardHeader>
          <CardContent>{renderChart(twoYearData, chartColors.twoYear)}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: chartColors.tenYear }} />
              10-Year Treasury (IEF)
            </CardTitle>
          </CardHeader>
          <CardContent>{renderChart(tenYearData, chartColors.tenYear)}</CardContent>
        </Card>
      </div>

      {/* Yield Spread */}
      {twoYearData && tenYearData && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Yield Curve Indicator</div>
                <div className="text-lg font-semibold">
                  {tenYearData.currentPrice > twoYearData.currentPrice ? (
                    <span className="text-primary">Normal (IEF {">"} SHY)</span>
                  ) : (
                    <span className="text-destructive">Inverted (SHY {">"} IEF)</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Price Spread</div>
                <div className="text-lg font-mono">
                  ${(tenYearData.currentPrice - twoYearData.currentPrice).toFixed(2)}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Note: ETF prices move inversely to yields. An inverted yield curve (short-term rates {">"} long-term) often signals recession risk.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default YieldAndVixCharts;
