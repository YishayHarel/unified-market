import { useState, useEffect } from "react";
import { Newspaper, ExternalLink, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  category: string;
}

const NewsSection = () => {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(3);
  
  // Expanded mock news data
  const [allNews] = useState([
    {
      title: "Federal Reserve Announces Interest Rate Decision",
      source: "Reuters",
      time: "2 hours ago"
    },
    {
      title: "Tech Stocks Rally Amid AI Optimism", 
      source: "Bloomberg",
      time: "4 hours ago"
    },
    {
      title: "Energy Sector Shows Strong Q4 Performance",
      source: "CNBC", 
      time: "6 hours ago"
    },
    {
      title: "Banking Sector Reports Record Quarterly Earnings",
      source: "Wall Street Journal",
      time: "8 hours ago"
    },
    {
      title: "Cryptocurrency Market Sees Major Volatility",
      source: "CoinDesk",
      time: "10 hours ago"
    },
    {
      title: "Manufacturing Data Shows Economic Strength",
      source: "Financial Times",
      time: "12 hours ago"
    },
    {
      title: "Consumer Confidence Index Reaches New High",
      source: "MarketWatch",
      time: "14 hours ago"
    },
    {
      title: "Healthcare Stocks Surge on FDA Approvals",
      source: "Seeking Alpha",
      time: "16 hours ago"
    },
    {
      title: "Retail Sales Data Exceeds Expectations",
      source: "Yahoo Finance",
      time: "18 hours ago"
    },
    {
      title: "International Trade Agreements Impact Markets",
      source: "Reuters",
      time: "20 hours ago"
    },
    {
      title: "Climate Technology Investments Soar",
      source: "Green Finance",
      time: "22 hours ago"
    },
    {
      title: "Semiconductor Industry Updates Production Forecast",
      source: "Tech Crunch",
      time: "1 day ago"
    },
    {
      title: "Global Supply Chain Improvements Noted",
      source: "Supply Chain Dive",
      time: "1 day ago"
    },
    {
      title: "Housing Market Shows Continued Growth",
      source: "Housing Wire",
      time: "1 day ago"
    },
    {
      title: "Aerospace Industry Reaches New Milestones",
      source: "Aviation Week",
      time: "1 day ago"
    }
  ]);

  const handleLoadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      if (displayedCount === 3) {
        // First load more: show 7 more to reach 10 total
        setDisplayedCount(10);
      } else {
        // Subsequent loads: add 10 more
        setDisplayedCount(prev => prev + 10);
      }
      setLoadingMore(false);
    }, 500);
  };

  // Mock data for demonstration
  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 800);
  }, []);

  if (loading) {
    return (
      <section>
        <h2 className="text-2xl font-semibold mb-4">📰 Latest News</h2>
        <p>Loading...</p>
      </section>
    );
  }

  const displayedNews = allNews.slice(0, displayedCount);
  const hasMoreNews = displayedCount < allNews.length;

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">📰 Latest News</h2>
      <div className="space-y-4">
        {displayedNews.map((article, index) => (
          <div key={index} className="pb-4 border-b border-border last:border-b-0">
            <a href="#" className="text-blue-400 hover:underline font-medium">
              {article.title}
            </a>
            <div className="text-sm text-muted-foreground mt-1">
              {article.source} • {article.time}
            </div>
          </div>
        ))}
        
        {hasMoreNews && (
          <div className="pt-4 text-center">
            <Button 
              onClick={handleLoadMore} 
              disabled={loadingMore}
              variant="outline"
              className="w-full sm:w-auto"
            >
              {loadingMore ? "Loading..." : "Load More"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default NewsSection;