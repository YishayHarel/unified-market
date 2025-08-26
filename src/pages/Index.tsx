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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              UnifiedMarket
            </h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-8">
          <h2 className="text-4xl font-bold text-foreground">
            Your Complete Financial Dashboard
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Track stocks, monitor dividends, stay updated with market news, and never miss an earnings call
          </p>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-card to-card/50 border-accent/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Market Status</p>
                  <p className="text-xl font-semibold text-primary">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-card to-card/50 border-accent/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Search className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Watchlist</p>
                  <p className="text-xl font-semibold">12 Stocks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/50 border-accent/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dividends</p>
                  <p className="text-xl font-semibold">$1,245</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/50 border-accent/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Earnings</p>
                  <p className="text-xl font-semibold">5 This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
    </div>
  );
};

export default Index;