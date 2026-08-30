import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WatchlistAlerts from "@/components/WatchlistAlerts";
import MarketSentimentDashboard from "@/components/MarketSentimentDashboard";
import AIPortfolioOptimizer from "@/components/AIPortfolioOptimizer";
import SmartNewsSummarizer from "@/components/SmartNewsSummarizer";
import SectorHeatMap from "@/components/analytics/SectorHeatMap";
import StockScreener from "@/components/analytics/StockScreener";
import MarketBreadth from "@/components/analytics/MarketBreadth";
import CorrelationMatrix from "@/components/analytics/CorrelationMatrix";
import VolumeProfile from "@/components/analytics/VolumeProfile";
import TechnicalIndicators from "@/components/analytics/TechnicalIndicators";
import AIScreener from "@/components/ai/AIScreener";
import AIRiskAssessment from "@/components/ai/AIRiskAssessment";

const AdvancedAnalytics = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24 space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold">Advanced Analytics</h1>
        <p className="text-muted-foreground mt-2">AI-powered insights & technical analysis</p>
      </header>
      
      <Tabs defaultValue="analytics" className="w-full">
        {/* Eight tabs will not fit a phone. The grid wrapped them onto rows the
            container did not grow to hold, so the lower rows were clipped
            behind the panel below. Scroll them instead, and only use the grid
            once there is room for a single row. */}
        <TabsList className="flex w-full justify-start overflow-x-auto md:grid md:grid-cols-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger className="shrink-0" value="ai-screener">AI Screener</TabsTrigger>
          <TabsTrigger className="shrink-0" value="risk">Risk AI</TabsTrigger>
          {/* The portfolio panel already existed but had no trigger, so it
              could never be opened. */}
          <TabsTrigger className="shrink-0" value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger className="shrink-0" value="analytics">Analytics</TabsTrigger>
          <TabsTrigger className="shrink-0" value="screener">Screener</TabsTrigger>
          <TabsTrigger className="shrink-0" value="technicals">Technicals</TabsTrigger>
          <TabsTrigger className="shrink-0" value="sentiment">Sentiment</TabsTrigger>
          <TabsTrigger className="shrink-0" value="alerts">Alerts</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ai-screener" className="space-y-6">
          <AIScreener />
        </TabsContent>
        
        <TabsContent value="risk" className="space-y-6">
          <AIRiskAssessment />
        </TabsContent>
        
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectorHeatMap />
            <MarketBreadth />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <VolumeProfile />
            <CorrelationMatrix />
          </div>
        </TabsContent>
        
        <TabsContent value="screener" className="space-y-6">
          <StockScreener />
        </TabsContent>
        
        <TabsContent value="technicals" className="space-y-6">
          <TechnicalIndicators />
        </TabsContent>
        
        <TabsContent value="sentiment" className="space-y-6">
          <MarketSentimentDashboard />
          <SmartNewsSummarizer />
        </TabsContent>
        
        <TabsContent value="portfolio" className="space-y-6">
          <AIPortfolioOptimizer />
        </TabsContent>
        
        <TabsContent value="alerts" className="space-y-6">
          <WatchlistAlerts />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedAnalytics;
