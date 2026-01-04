import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { TrendingUp, TrendingDown, RefreshCw, Loader2, Activity, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ChartDataPoint {
  date: string;
  value: number;
}

interface YieldVixData {
  data: ChartDataPoint[];
  current: number;
  change: number;
}

const chartColors = {
  vix: "hsl(var(--chart-vix))",
  twoYear: "hsl(var(--chart-2y))",
  tenYear: "hsl(var(--chart-10y))",
};

const YieldAndVixCharts = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vixData, setVixData] = useState<YieldVixData | null>(null);
  const [twoYearData, setTwoYearData] = useState<YieldVixData | null>(null);
  const [tenYearData, setTenYearData] = useState<YieldVixData | null>(null);

  const fetchVix = async (): Promise<YieldVixData | null> => {
    const { data, error } = await supabase.functions.invoke("get-treasury-vix", {
      body: { type: "vix" },
    });

    if (error || !data?.data) {
      console.error("Error fetching VIX:", error);
      return null;
    }

    return {
      data: data.data.map((d: any) => ({
        date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: d.value,
      })),
      current: data.current,
      change: data.change,
    };
  };

  const fetchTreasury = async (maturity: string): Promise<YieldVixData | null> => {
    const { data, error } = await supabase.functions.invoke("get-treasury-vix", {
      body: { type: "treasury", maturity },
    });

    if (error || !data?.data) {
      console.error(`Error fetching Treasury ${maturity}:`, error);
      return null;
    }

    return {
      data: data.data.map((d: any) => ({
        date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: d.value,
      })),
      current: data.current,
      change: data.change,
    };
  };

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch sequentially to avoid hitting Alpha Vantage rate limit (5 calls/min on free tier)
      const vix = await fetchVix();
      setVixData(vix);

      await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait 1.5s between calls

      const twoYear = await fetchTreasury("2year");
      setTwoYearData(twoYear);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const tenYear = await fetchTreasury("10year");
      setTenYearData(tenYear);

      if (!vix && !twoYear && !tenYear) {
        setError("Unable to fetch data. API may be rate limited. Try again in a minute.");
      }
    } catch (err) {
      console.error("Error fetching chart data:", err);
      setError("Failed to load chart data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const renderChart = (
    data: YieldVixData | null,
    color: string,
    label: string,
    isPercentage: boolean = true
  ) => {
    if (!data) {
      return (
        <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
          <AlertCircle className="h-4 w-4" />
          No data available
        </div>
      );
    }

    const isPositive = data.change >= 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold font-mono">
              {data.current.toFixed(2)}{isPercentage ? "%" : ""}
            </div>
            <div className={`flex items-center gap-1 text-sm ${isPositive ? "text-destructive" : "text-primary"}`}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>
                {isPositive ? "+" : ""}
                {data.change.toFixed(3)}{isPercentage ? "%" : ""} from prev day
              </span>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {label}
          </Badge>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data.data}>
            <defs>
              <linearGradient id={`gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
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
              tickFormatter={(val) => `${val.toFixed(2)}${isPercentage ? "%" : ""}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number) => [
                `${value.toFixed(2)}${isPercentage ? "%" : ""}`,
                isPercentage ? "Yield" : "VIX"
              ]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${label})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Treasury Yields & VIX...
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-muted-foreground text-center">
            <p>Fetching real yield and volatility data...</p>
            <p className="text-xs mt-2">This may take a few seconds due to API rate limits</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !vixData && !twoYearData && !tenYearData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Treasury Yields & VIX
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAllData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Calculate yield spread
  const yieldSpread = twoYearData && tenYearData 
    ? tenYearData.current - twoYearData.current 
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Treasury Yields & Volatility
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs text-muted-foreground">
            ~15 min delay
          </Badge>
          <Button variant="ghost" size="sm" onClick={fetchAllData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* VIX Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" style={{ color: chartColors.vix }} />
            CBOE Volatility Index (VIX)
            <span className="text-xs text-muted-foreground font-normal ml-2">
              "Fear Gauge" - measures expected 30-day volatility
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderChart(vixData, chartColors.vix, "VIX", false)}
          {vixData && (
            <div className="mt-2 text-xs text-muted-foreground">
              {vixData.current < 15 ? "🟢 Low volatility (complacency)" : 
               vixData.current < 20 ? "🟡 Normal volatility" :
               vixData.current < 30 ? "🟠 Elevated volatility (caution)" :
               "🔴 High volatility (fear)"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Treasury Yield Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: chartColors.twoYear }} />
              2-Year Treasury Yield
            </CardTitle>
          </CardHeader>
          <CardContent>{renderChart(twoYearData, chartColors.twoYear, "2Y Yield", true)}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: chartColors.tenYear }} />
              10-Year Treasury Yield
            </CardTitle>
          </CardHeader>
          <CardContent>{renderChart(tenYearData, chartColors.tenYear, "10Y Yield", true)}</CardContent>
        </Card>
      </div>

      {/* Yield Spread / Curve */}
      {yieldSpread !== null && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Yield Curve (10Y - 2Y Spread)</div>
                <div className="text-lg font-semibold">
                  {yieldSpread >= 0 ? (
                    <span className="text-primary">Normal Curve</span>
                  ) : (
                    <span className="text-destructive">Inverted Curve ⚠️</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Spread</div>
                <div className={`text-xl font-mono ${yieldSpread >= 0 ? "text-primary" : "text-destructive"}`}>
                  {yieldSpread >= 0 ? "+" : ""}{yieldSpread.toFixed(3)}%
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {yieldSpread < 0 
                ? "An inverted yield curve (2Y > 10Y) has historically preceded recessions."
                : "A normal yield curve (10Y > 2Y) indicates healthy economic expectations."}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default YieldAndVixCharts;
