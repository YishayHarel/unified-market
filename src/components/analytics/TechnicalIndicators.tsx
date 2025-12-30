import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LineChart, Search, TrendingUp, TrendingDown, Activity } from "lucide-react";

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
}

const TechnicalIndicators = () => {
  const [symbol, setSymbol] = useState("AAPL");
  const [searchInput, setSearchInput] = useState("AAPL");
  const [settings, setSettings] = useState<IndicatorSettings>({
    sma20: true,
    sma50: true,
    ema12: false,
    ema26: false,
    rsi: true,
    macd: true,
    bollingerBands: false,
  });

  // Simulated indicator values
  const values = useMemo<IndicatorValues>(() => {
    const basePrice = 180 + Math.random() * 20;
    const volatility = 5 + Math.random() * 10;
    
    return {
      sma20: basePrice - 2 + Math.random() * 4,
      sma50: basePrice - 5 + Math.random() * 10,
      ema12: basePrice - 1 + Math.random() * 2,
      ema26: basePrice - 3 + Math.random() * 6,
      rsi: 30 + Math.random() * 40, // RSI between 30-70
      macdLine: -2 + Math.random() * 4,
      macdSignal: -1.5 + Math.random() * 3,
      macdHistogram: -0.5 + Math.random() * 1,
      upperBand: basePrice + volatility,
      lowerBand: basePrice - volatility,
      middleBand: basePrice,
    };
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

  const rsiSignal = getRSISignal(values.rsi);
  const macdSignal = getMACDSignal(values.macdHistogram);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineChart className="h-5 w-5" />
          Technical Indicators
        </CardTitle>
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
          <Badge variant="outline">Technical Analysis</Badge>
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
                  <span className="font-mono">${values.sma20.toFixed(2)}</span>
                </div>
              )}
              {settings.sma50 && (
                <div className="flex justify-between">
                  <span className="text-sm">SMA (50)</span>
                  <span className="font-mono">${values.sma50.toFixed(2)}</span>
                </div>
              )}
              {settings.ema12 && (
                <div className="flex justify-between">
                  <span className="text-sm">EMA (12)</span>
                  <span className="font-mono">${values.ema12.toFixed(2)}</span>
                </div>
              )}
              {settings.ema26 && (
                <div className="flex justify-between">
                  <span className="text-sm">EMA (26)</span>
                  <span className="font-mono">${values.ema26.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* RSI */}
          {settings.rsi && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">RSI (14)</h4>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{values.rsi.toFixed(1)}</span>
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
                  style={{ width: `${values.rsi}%` }}
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
                      <div className="font-mono">{values.macdLine.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Signal</div>
                      <div className="font-mono">{values.macdSignal.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Histogram</div>
                      <div className={`font-mono ${values.macdHistogram >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {values.macdHistogram.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
                <Badge className={macdSignal.color.replace("text-", "bg-").replace("-500", "-500/20").replace("-400", "-400/20") + " " + macdSignal.color}>
                  {values.macdHistogram >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
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
                  <span className="font-mono">${values.upperBand.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Middle Band (SMA)</span>
                  <span className="font-mono">${values.middleBand.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-red-500">Lower Band</span>
                  <span className="font-mono">${values.lowerBand.toFixed(2)}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Band Width: ${(values.upperBand - values.lowerBand).toFixed(2)}
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
