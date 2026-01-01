import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LineChart, Search, TrendingUp, TrendingDown, Activity, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface IndicatorSettings {
  sma20: boolean;
  sma50: boolean;
  ema12: boolean;
  ema26: boolean;
  rsi: boolean;
  macd: boolean;
  bollingerBands: boolean;
}

interface IndicatorValues {
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  rsi: number;
  macdLine: number;
  macdSignal: number;
  macdHistogram: number;
  upperBand: number;
  lowerBand: number;
  middleBand: number;
  currentPrice: number;
}

const TechnicalIndicators = () => {
  const [symbol, setSymbol] = useState("AAPL");
  const [searchInput, setSearchInput] = useState("AAPL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<IndicatorValues | null>(null);
  const [settings, setSettings] = useState<IndicatorSettings>({
    sma20: true,
    sma50: true,
    ema12: false,
    ema26: false,
    rsi: true,
    macd: true,
    bollingerBands: false,
  });

  const fetchIndicators = async (sym: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('get-stock-candles', {
        body: { symbol: sym.toUpperCase(), period: '3M', includeIndicators: true }
      });
      
      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to fetch indicators');
      }
      
      if (!data?.indicators) {
        setError('Insufficient data for technical analysis');
        setValues(null);
        return;
      }
      
      setValues(data.indicators);
    } catch (err: any) {
      console.error('Error fetching indicators:', err);
      setError(err.message || 'Failed to load technical indicators');
      setValues(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIndicators(symbol);
  }, [symbol]);

  const handleSearch = () => {
    setSymbol(searchInput.toUpperCase());
  };

  const toggleIndicator = (key: keyof IndicatorSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getRSISignal = (rsi: number): { text: string; color: string } => {
    if (rsi >= 70) return { text: "Overbought", color: "text-red-500" };
    if (rsi <= 30) return { text: "Oversold", color: "text-green-500" };
    return { text: "Neutral", color: "text-muted-foreground" };
  };

  const getMACDSignal = (histogram: number): { text: string; color: string } => {
    if (histogram > 0.5) return { text: "Strong Buy", color: "text-green-500" };
    if (histogram > 0) return { text: "Buy", color: "text-green-400" };
    if (histogram < -0.5) return { text: "Strong Sell", color: "text-red-500" };
    if (histogram < 0) return { text: "Sell", color: "text-red-400" };
    return { text: "Neutral", color: "text-muted-foreground" };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Technical Indicators
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <div className="text-muted-foreground">Loading real-time indicators...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !values) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            Technical Indicators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter symbol..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-muted-foreground font-medium">{error || 'No data available'}</p>
              <p className="text-sm text-muted-foreground">Could not load indicators for {symbol}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchIndicators(symbol)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const rsiSignal = getRSISignal(values.rsi);
  const macdSignal = getMACDSignal(values.macdHistogram);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            Technical Indicators
          </CardTitle>
          <Badge variant="outline" className="text-green-500 border-green-500">
            Live Data
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Symbol Search */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter symbol..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{symbol}</h3>
          <Badge variant="outline">
            ${values.currentPrice?.toFixed(2) || 'N/A'}
          </Badge>
        </div>

        {/* Indicator Toggles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries({
            sma20: "SMA (20)",
            sma50: "SMA (50)",
            ema12: "EMA (12)",
            ema26: "EMA (26)",
            rsi: "RSI (14)",
            macd: "MACD",
            bollingerBands: "Bollinger",
          }).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <Switch
                id={key}
                checked={settings[key as keyof IndicatorSettings]}
                onCheckedChange={() => toggleIndicator(key as keyof IndicatorSettings)}
              />
              <Label htmlFor={key} className="text-sm">{label}</Label>
            </div>
          ))}
        </div>

        {/* Indicator Values */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Moving Averages */}
          {(settings.sma20 || settings.sma50 || settings.ema12 || settings.ema26) && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">Moving Averages</h4>
              {settings.sma20 && (
                <div className="flex justify-between">
                  <span className="text-sm">SMA (20)</span>
                  <span className="font-mono">${values.sma20?.toFixed(2) || 'N/A'}</span>
                </div>
              )}
              {settings.sma50 && (
                <div className="flex justify-between">
                  <span className="text-sm">SMA (50)</span>
                  <span className="font-mono">${values.sma50?.toFixed(2) || 'N/A'}</span>
                </div>
              )}
              {settings.ema12 && (
                <div className="flex justify-between">
                  <span className="text-sm">EMA (12)</span>
                  <span className="font-mono">${values.ema12?.toFixed(2) || 'N/A'}</span>
                </div>
              )}
              {settings.ema26 && (
                <div className="flex justify-between">
                  <span className="text-sm">EMA (26)</span>
                  <span className="font-mono">${values.ema26?.toFixed(2) || 'N/A'}</span>
                </div>
              )}
            </div>
          )}

          {/* RSI */}
          {settings.rsi && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">RSI (14)</h4>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{values.rsi?.toFixed(1) || 'N/A'}</span>
                <Badge className={rsiSignal.color.replace("text-", "bg-").replace("-500", "-500/20") + " " + rsiSignal.color}>
                  {rsiSignal.text}
                </Badge>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    values.rsi >= 70 ? "bg-red-500" :
                    values.rsi <= 30 ? "bg-green-500" : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, values.rsi || 0))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Oversold (30)</span>
                <span>Overbought (70)</span>
              </div>
            </div>
          )}

          {/* MACD */}
          {settings.macd && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">MACD</h4>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Line</div>
                      <div className="font-mono">{values.macdLine?.toFixed(2) || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Signal</div>
                      <div className="font-mono">{values.macdSignal?.toFixed(2) || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Histogram</div>
                      <div className={`font-mono ${(values.macdHistogram || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {values.macdHistogram?.toFixed(2) || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
                <Badge className={macdSignal.color.replace("text-", "bg-").replace("-500", "-500/20").replace("-400", "-400/20") + " " + macdSignal.color}>
                  {(values.macdHistogram || 0) >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                  {macdSignal.text}
                </Badge>
              </div>
            </div>
          )}

          {/* Bollinger Bands */}
          {settings.bollingerBands && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">Bollinger Bands (20, 2)</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-green-500">Upper Band</span>
                  <span className="font-mono">${values.upperBand?.toFixed(2) || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Middle Band (SMA)</span>
                  <span className="font-mono">${values.middleBand?.toFixed(2) || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-red-500">Lower Band</span>
                  <span className="font-mono">${values.lowerBand?.toFixed(2) || 'N/A'}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Band Width: ${((values.upperBand || 0) - (values.lowerBand || 0)).toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Overall Signal</span>
            <div className="flex items-center gap-2">
              {values.rsi <= 40 && values.macdHistogram > 0 ? (
                <Badge className="bg-green-500">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Bullish
                </Badge>
              ) : values.rsi >= 60 && values.macdHistogram < 0 ? (
                <Badge className="bg-red-500">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  Bearish
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Activity className="h-3 w-3 mr-1" />
                  Neutral
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TechnicalIndicators;
