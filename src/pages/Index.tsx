import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import TopMovers from "@/components/TopMovers";
import NewsSection from "@/components/NewsSection";
import StockSearch from "@/components/StockSearch";
import bullLogo from "@/assets/bull-logo.png";

const Index = () => {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section with Gradient Background */}
      <div className="bg-gradient-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-5"></div>
        <div className="relative p-6 pb-12 space-y-8">
          <header className="text-center relative max-w-4xl mx-auto">
            {user && (
              <div className="absolute top-0 right-0 flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-3 py-2 rounded-full shadow-card">
                  <User className="w-4 h-4 text-primary" />
                  <span className="font-medium">{user.email}</span>
                </div>
                <Button variant="outline" size="sm" onClick={signOut} className="shadow-card">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <img 
                  src={bullLogo} 
                  alt="UnifiedMarket Bull Logo" 
                  className="w-32 h-32 object-contain"
                />
                <h1 className="text-5xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  UnifiedMarket
                </h1>
              </div>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Your gateway to <span className="text-primary font-semibold">financial markets</span>, 
                powered by AI-driven insights and real-time data
              </p>
            </div>
            
            {!user && (
              <div className="mt-8 space-y-4">
                <Button asChild size="lg" className="bg-gradient-primary hover:opacity-90 shadow-elegant text-lg px-8 py-6">
                  <Link to="/auth">Get Started Free</Link>
                </Button>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Join thousands of investors • Save stocks • Track dividends • Get personalized insights
                </p>
              </div>
            )}
          </header>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-24 space-y-12 max-w-7xl mx-auto">
        {/* Feature Cards Row */}
        {user && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 -mt-6 relative z-10">
            <div className="bg-card p-6 rounded-2xl shadow-card border border-border hover:shadow-elegant transition-all duration-300">
              <div className="text-2xl mb-2">💰</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Portfolio Tracking</h3>
              <p className="text-sm text-muted-foreground">Monitor your investments with real-time updates</p>
            </div>
            <div className="bg-card p-6 rounded-2xl shadow-card border border-border hover:shadow-elegant transition-all duration-300">
              <div className="text-2xl mb-2">🤖</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">AI Insights</h3>
              <p className="text-sm text-muted-foreground">Get personalized stock recommendations powered by AI</p>
            </div>
            <div className="bg-card p-6 rounded-2xl shadow-card border border-border hover:shadow-elegant transition-all duration-300">
              <div className="text-2xl mb-2">📊</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Market Analysis</h3>
              <p className="text-sm text-muted-foreground">Deep dive into market trends and analytics</p>
            </div>
          </div>
        )}

        {/* Top Movers Section */}
        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground mb-2">Market Movers</h2>
            <p className="text-muted-foreground">Today's biggest gainers and losers</p>
          </div>
          <TopMovers />
        </section>

        {/* Stock Search Section */}
        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground mb-2">Discover Stocks</h2>
            <p className="text-muted-foreground">Search and analyze any stock in real-time</p>
          </div>
          <div className="max-w-2xl mx-auto">
            <StockSearch />
          </div>
        </section>

        {/* News Section */}
        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground mb-2">Latest Market News</h2>
            <p className="text-muted-foreground">Stay updated with the latest financial developments</p>
          </div>
          <NewsSection />
        </section>
      </div>
    </div>
  );
};

export default Index;