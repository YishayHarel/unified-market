import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StockAutocomplete from "@/components/StockAutocomplete";
import IndexMiniChartCard from "@/components/IndexMiniChartCard";
import CompactTopMoversStrip from "@/components/CompactTopMoversStrip";
import { useStockPrices } from "@/hooks/useStockPrices";

const INDEX_ROWS: { symbol: string; label: string }[] = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "VOO", label: "VOO" },
  { symbol: "QQQ", label: "QQQ" },
  { symbol: "ONEQ", label: "Nasdaq (comp.)" },
];

const MarketsOverviewWidget = () => {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");

  const symbols = INDEX_ROWS.map((r) => r.symbol);
  const { prices } = useStockPrices(symbols);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Markets at a glance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Search a stock</label>
          <StockAutocomplete
            value={searchValue}
            onChange={setSearchValue}
            onSelect={(stock) => {
              navigate(`/stock/${stock.symbol}`);
              setSearchValue("");
            }}
            placeholder="Ticker or company name…"
            className="w-full"
          />
        </div>

        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Major indices &amp; ETFs</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
            {INDEX_ROWS.map(({ symbol, label }) => (
              <button
                key={symbol}
                type="button"
                className="text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                onClick={() => navigate(`/stock/${symbol}`)}
              >
                <IndexMiniChartCard symbol={symbol} label={label} priceData={prices.get(symbol)} />
              </button>
            ))}
          </div>
        </div>

        <CompactTopMoversStrip />
      </CardContent>
    </Card>
  );
};

export default MarketsOverviewWidget;
