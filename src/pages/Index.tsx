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
        {/* Hero – large typography to fill the screen */}
        <header className="flex-1 min-h-0 flex flex-col justify-center items-center text-center px-4 py-6">
          <div className="flex flex-col items-center gap-4 md:gap-6 max-w-3xl mx-auto">
            <img src={bullLogo} alt="UnifiedMarket" className="w-24 h-24 sm:w-28 sm:h-28 md:w-36 md:h-36 object-contain" />
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-primary bg-clip-text text-transparent leading-tight">
              UnifiedMarket
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-white/95 max-w-2xl mx-auto leading-snug">
              Your gateway to <span className="text-primary font-semibold">financial markets</span>, powered by AI and real-time data
            </p>
            {!user && (
              <div className="mt-4 md:mt-6">
                <Button asChild size="lg" className="bg-gradient-primary hover:opacity-90 shadow-lg text-lg md:text-xl px-8 py-6 h-auto">
                  <Link to="/auth">Get Started For Free</Link>
                </Button>
                <p className="text-sm md:text-base text-white/85 mt-3">Save stocks • Track dividends • AI insights</p>
              </div>
            )}
          </div>
        </header>

        {/* Market Movers – fixed strip at bottom */}
        <section className="flex-shrink-0 flex flex-col pt-2 pb-2 px-2">
          <div className="text-center mb-2">
            <h2 className="text-xl md:text-2xl font-bold text-white drop-shadow-md">Market Movers</h2>
            <p className="text-sm text-white/85">Today&apos;s biggest gainers and losers</p>
          </div>
          <TopMovers compact />
        </section>
      </div>
    </div>
  );
};

export default Index;
