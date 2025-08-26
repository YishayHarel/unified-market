import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Newspaper, ExternalLink, Clock, TrendingUp } from "lucide-react";

interface StockNewsProps {
  symbol: string;
}

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment: "positive" | "negative" | "neutral";
  relevanceScore: number;
}

const StockNews = ({ symbol }: StockNewsProps) => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock stock-specific news
    const mockNews: NewsArticle[] = [
      {
        id: "1",
        title: `${symbol} Reports Strong Q4 Earnings, Beats Analyst Expectations`,
        summary: `${symbol} announced quarterly earnings that exceeded analyst forecasts, driven by strong product sales and service revenue growth.`,
        source: "Reuters",
        publishedAt: "2024-01-15T14:30:00Z",
        url: "#",
        sentiment: "positive",
        relevanceScore: 95
      },
      {
        id: "2",
        title: `Analyst Upgrades ${symbol} to Strong Buy on Innovation Pipeline`,
        summary: `Major investment firm raises price target citing strong upcoming product lineup and expanding market opportunities.`,
        source: "Bloomberg",
        publishedAt: "2024-01-15T11:45:00Z",
        url: "#",
        sentiment: "positive",
        relevanceScore: 88
      },
      {
        id: "3",
        title: `${symbol} Announces New Partnership in AI Technology Sector`,
        summary: `Strategic alliance aimed at accelerating artificial intelligence capabilities and expanding market reach in emerging technologies.`,
        source: "TechCrunch",
        publishedAt: "2024-01-14T16:20:00Z",
        url: "#",
        sentiment: "positive",
        relevanceScore: 82
      },
      {
        id: "4",
        title: `Supply Chain Concerns May Impact ${symbol} Production Timeline`,
        summary: `Industry analysts warn of potential delays in manufacturing due to ongoing global supply chain challenges.`,
        source: "Wall Street Journal",
        publishedAt: "2024-01-14T09:15:00Z",
        url: "#",
        sentiment: "negative",
        relevanceScore: 75
      },
      {
        id: "5",
        title: `${symbol} Stock Reaches New 52-Week High Amid Market Rally`,
        summary: `Share price continues upward momentum as investors show confidence in company's long-term growth strategy.`,
        source: "MarketWatch",
        publishedAt: "2024-01-13T15:30:00Z",
        url: "#",
        sentiment: "positive",
        relevanceScore: 70
      }
    ];

    setTimeout(() => {
      setNews(mockNews);
      setLoading(false);
    }, 600);
  }, [symbol]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours === 1) return "1 hour ago";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return "text-green-400 bg-green-400/10 border-green-400/20";
      case "negative": return "text-red-400 bg-red-400/10 border-red-400/20";
      default: return "text-muted-foreground bg-muted/10 border-muted/20";
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return <TrendingUp className="w-3 h-3" />;
      case "negative": return <TrendingUp className="w-3 h-3 rotate-180" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Newspaper className="w-5 h-5 text-primary" />
            {symbol} News
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-full"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Newspaper className="w-5 h-5 text-primary" />
          {symbol} News & Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {news.map((article) => (
          <div
            key={article.id}
            className="p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold leading-tight text-sm hover:text-primary cursor-pointer">
                  {article.title}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  asChild
                >
                  <a href={article.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
              
              {/* Summary */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {article.summary}
              </p>
              
              {/* Meta Info */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-primary">{article.source}</span>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(article.publishedAt)}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {article.relevanceScore}% relevant
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getSentimentColor(article.sentiment)}`}
                  >
                    <span className="flex items-center gap-1">
                      {getSentimentIcon(article.sentiment)}
                      {article.sentiment}
                    </span>
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        <Button variant="outline" className="w-full mt-4">
          Load More News
        </Button>
      </CardContent>
    </Card>
  );
};

export default StockNews;