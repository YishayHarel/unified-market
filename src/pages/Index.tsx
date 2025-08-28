import TopMovers from "@/components/TopMovers";
import NewsSection from "@/components/NewsSection";
import StockSearch from "@/components/StockSearch";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24 space-y-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold">📈 UnifiedMarket</h1>
        <p className="text-muted-foreground mt-2">Your gateway to financial markets</p>
      </header>

      {/* Top Movers */}
      <TopMovers />

      {/* Stock Search */}
      <StockSearch />

      {/* News */}
      <NewsSection />
    </div>
  );
};

export default Index;