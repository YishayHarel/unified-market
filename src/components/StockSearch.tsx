import { useNavigate } from "react-router-dom";
import StockAutocomplete from "@/components/StockAutocomplete";
import { useState } from "react";

const StockSearch = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleStockSelect = (stock: { symbol: string }) => {
    navigate(`/stock/${stock.symbol}`);
  };

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">🔍 Stock Search</h2>
      <StockAutocomplete
        value={searchQuery}
        onChange={setSearchQuery}
        onSelect={handleStockSelect}
        placeholder="Search stocks by symbol or company name..."
      />
    </section>
  );
};

export default StockSearch;