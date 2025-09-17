import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WatchlistAlerts from "@/components/WatchlistAlerts";
import MarketSentimentDashboard from "@/components/MarketSentimentDashboard";
import AIPortfolioOptimizer from "@/components/AIPortfolioOptimizer";
import SmartNewsSummarizer from "@/components/SmartNewsSummarizer";

const AdvancedAnalytics = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24 space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold">🧠 Advanced Analytics</h1>
        <p className="text-muted-foreground mt-2">AI-powered market insights and portfolio optimization</p>
      </header>
      
      <Tabs defaultValue="sentiment" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sentiment">Market Sentiment</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio AI</TabsTrigger>
          <TabsTrigger value="news">Smart News</TabsTrigger>
          <TabsTrigger value="alerts">Watchlist</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sentiment" className="space-y-6">
          <MarketSentimentDashboard />
        </TabsContent>
        
        <TabsContent value="portfolio" className="space-y-6">
          <AIPortfolioOptimizer />
        </TabsContent>
        
        <TabsContent value="news" className="space-y-6">
          <SmartNewsSummarizer />
        </TabsContent>
        
        <TabsContent value="alerts" className="space-y-6">
          <WatchlistAlerts />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedAnalytics;