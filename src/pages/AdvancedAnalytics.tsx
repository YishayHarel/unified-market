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
import AIDailyBrief from "@/components/ai/AIDailyBrief";

const AdvancedAnalytics = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24 space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold">Advanced Analytics</h1>
        <p className="text-muted-foreground mt-2">AI-powered insights & technical analysis</p>
      </header>
      
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:grid-cols-8">
          <TabsTrigger value="brief">Daily Brief</TabsTrigger>
          <TabsTrigger value="ai-screener">AI Screener</TabsTrigger>
          <TabsTrigger value="risk">Risk AI</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="screener">Screener</TabsTrigger>
          <TabsTrigger value="technicals">Technicals</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>
        
        <TabsContent value="brief" className="space-y-6">
          <AIDailyBrief />
        </TabsContent>
        
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
