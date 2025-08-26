import { useState } from "react";
import { TrendingUp, Search, Calendar, Newspaper, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TopMovers from "@/components/TopMovers";
import NewsSection from "@/components/NewsSection";
import EarningsCalendar from "@/components/EarningsCalendar";
import StockSearch from "@/components/StockSearch";
import DividendTracker from "@/components/DividendTracker";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-8 space-y-16">
      <h1 className="text-center text-4xl font-bold">📈 UnifiedMarket</h1>

      {/* Stock Search */}
      <StockSearch />

      {/* Top Movers */}
      <TopMovers />

      {/* News & Earnings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <NewsSection />
        <EarningsCalendar />
      </div>

      {/* Dividend Tracker */}
      <DividendTracker />
    </div>
  );
};

export default Index;