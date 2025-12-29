import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

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

interface StockFundamentalsProps {
  stockData: StockData;
}

const formatVolume = (volume: number) => {
  if (!volume || volume === 0) return 'N/A';
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
  return volume.toLocaleString();
};

const StockFundamentals = ({ stockData }: StockFundamentalsProps) => {
  const fundamentals = [
    {
      label: "Market Cap",
      value: stockData.marketCap,
      description: "Total market value"
    },
    {
      label: "P/E Ratio",
      value: stockData.peRatio ? stockData.peRatio.toFixed(2) : 'N/A',
      description: "Price-to-earnings ratio"
    },
    {
      label: "Dividend Yield",
      value: stockData.dividendYield ? `${stockData.dividendYield.toFixed(2)}%` : 'N/A',
      description: "Annual dividend rate"
    },
    {
      label: "52W High",
      value: stockData.weekHigh52 ? `$${stockData.weekHigh52.toFixed(2)}` : 'N/A',
      description: "52-week high"
    },
    {
      label: "52W Low",
      value: stockData.weekLow52 ? `$${stockData.weekLow52.toFixed(2)}` : 'N/A',
      description: "52-week low"
    },
    {
      label: "Volume",
      value: formatVolume(stockData.volume),
      description: "Today's trading volume"
    },
    {
      label: "Avg Volume",
      value: formatVolume(stockData.avgVolume),
      description: "Average daily volume"
    }
  ];

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-primary" />
          Key Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fundamentals.map((item, index) => (
          <div key={index} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
            <div>
              <div className="font-medium text-sm">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.description}</div>
            </div>
            <div className="font-semibold text-right">
              {item.value}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default StockFundamentals;
