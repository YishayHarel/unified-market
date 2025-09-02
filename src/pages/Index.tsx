import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import TopMovers from "@/components/TopMovers";
import NewsSection from "@/components/NewsSection";
import StockSearch from "@/components/StockSearch";

const Index = () => {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24 space-y-8">
      <header className="text-center relative">
        {user && (
          <div className="absolute top-0 right-0 flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              {user.email}
            </div>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
        <h1 className="text-4xl font-bold">📈 UnifiedMarket</h1>
        <p className="text-muted-foreground mt-2">Your gateway to financial markets</p>
        {!user && (
          <div className="mt-4">
            <Button asChild>
              <Link to="/auth">Sign In / Sign Up</Link>
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Sign in to save stocks, track dividends, and get personalized data
            </p>
          </div>
        )}
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