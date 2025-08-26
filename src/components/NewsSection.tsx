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
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data for demonstration
  useEffect(() => {
    const mockNews: NewsArticle[] = [
      {
        id: "1",
        title: "Federal Reserve Announces Interest Rate Decision",
        summary: "The Federal Reserve keeps interest rates unchanged at 5.25-5.5% range, citing economic stability.",
        source: "Reuters",
        publishedAt: "2024-01-15T14:30:00Z",
        url: "#",
        category: "Economic Policy"
      },
      {
        id: "2",
        title: "Tech Stocks Rally Amid AI Optimism",
        summary: "Major technology stocks surge as investors show renewed confidence in artificial intelligence sector growth.",
        source: "Bloomberg",
        publishedAt: "2024-01-15T12:45:00Z",
        url: "#",
        category: "Technology"
      },
      {
        id: "3",
        title: "Energy Sector Shows Strong Q4 Performance",
        summary: "Oil and gas companies report better-than-expected earnings as global energy demand remains robust.",
        source: "CNBC",
        publishedAt: "2024-01-15T10:15:00Z",
        url: "#",
        category: "Energy"
      }
    ];

    setTimeout(() => {
      setNews(mockNews);
      setLoading(false);
    }, 800);
  }, []);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours === 1) return "1 hour ago";
    return `${diffInHours} hours ago`;
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/50 border-accent/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            Market News
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-accent/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          Market News
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {news.map((article) => (
          <div
            key={article.id}
            className="p-4 rounded-lg border bg-gradient-to-r from-background to-muted/20 hover:from-muted/30 hover:to-muted/40 transition-all duration-200"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-foreground leading-tight text-sm">
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
              
              <p className="text-xs text-muted-foreground leading-relaxed">
                {article.summary}
              </p>
              
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-primary">{article.source}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{article.category}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(article.publishedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        <Button variant="outline" className="w-full mt-4">
          View All News
        </Button>
      </CardContent>
    </Card>
  );
};

export default NewsSection;