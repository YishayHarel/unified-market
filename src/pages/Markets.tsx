import TopMovers from "@/components/TopMovers";
import UserSavedStocks from "@/components/UserSavedStocks";
import { TopStocks } from "@/components/TopStocks";

const Markets = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24 space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold">📊 Markets</h1>
        <p className="text-muted-foreground mt-2">Market overview and your saved stocks</p>
      </header>
      
      <UserSavedStocks />
      <TopMovers />
      <TopStocks />
    </div>
  );
};

export default Markets;