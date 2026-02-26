import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import TopMovers from "@/components/TopMovers";
import HeaderMenu from "@/components/HeaderMenu";
import bullLogo from "@/assets/bull-logo.png";

/**
 * Front page: single full-screen view, no scroll.
 * Full-screen hero background image, compact hero content, Market Movers only.
 * News and Discover Stocks live in their own sections (News, Markets).
 */
const Index = () => {
  const { user, signOut } = useAuth();
  return (
    <div
      className="h-screen min-h-screen w-full overflow-hidden flex flex-col bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url(/hero-background.png)" }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/50 pointer-events-none z-0" aria-hidden />
      <div className="relative z-10 flex flex-col flex-1 min-h-0 px-4 pt-4 pb-24">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {user && (
            <>
              <div className="flex items-center gap-2 text-xs text-white/90 bg-white/10 backdrop-blur-sm px-2.5 py-1.5 rounded-full">
                <User className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium truncate max-w-[120px]">{user.email}</span>
              </div>
              <Button variant="outline" size="sm" onClick={signOut} className="shadow-md border-white/30 text-white hover:bg-white/20 h-8">
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          <HeaderMenu />
        </div>
        {/* Compact hero */}
        <header className="flex-shrink-0 text-center max-w-2xl mx-auto">
          <div className="flex flex-col items-center gap-2 pt-2">
            <img src={bullLogo} alt="UnifiedMarket" className="w-16 h-16 md:w-20 md:h-20 object-contain" />
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              UnifiedMarket
            </h1>
          </div>
          <p className="text-sm md:text-base text-white/90 max-w-lg mx-auto mt-1 leading-snug">
            Your gateway to <span className="text-primary font-semibold">financial markets</span>, powered by AI and real-time data
          </p>
          {!user && (
            <div className="mt-4">
              <Button asChild size="sm" className="bg-gradient-primary hover:opacity-90 shadow-lg text-sm px-5 py-5">
                <Link to="/auth">Get Started For Free</Link>
              </Button>
              <p className="text-xs text-white/80 mt-2">Save stocks • Track dividends • AI insights</p>
            </div>
          )}
        </header>

        {/* Market Movers – fills remaining space, compact */}
        <section className="flex-1 min-h-0 flex flex-col pt-4 px-2">
          <div className="text-center flex-shrink-0 mb-2">
            <h2 className="text-lg md:text-xl font-bold text-white drop-shadow-md">Market Movers</h2>
            <p className="text-xs text-white/85">Today&apos;s biggest gainers and losers</p>
          </div>
          <TopMovers compact />
        </section>
      </div>
    </div>
  );
};

export default Index;
