import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Newspaper, ExternalLink, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import NewsSentiment from "@/components/NewsSentiment";

interface StockNewsProps {
  symbol: string;
  companyName?: string;
}

interface NewsArticle {
  title: string;
  description: string;
  source: { name: string };
  publishedAt: string;
  url: string;
  urlToImage?: string;
}

const StockNews = ({ symbol, companyName }: StockNewsProps) => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('get-news', {
        body: { 
          symbol,
          companyName,
          pageSize: 10 
        }
      });

      if (fetchError) throw fetchError;
      
      if (data?.articles && data.articles.length > 0) {
        setNews(data.articles);
      } else {
        setNews([]);
      }
    } catch (err) {
      console.error('Error fetching stock news:', err);
      setError('Unable to load news');
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [symbol, companyName]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours === 1) return "1 hour ago";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
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

  if (error || news.length === 0) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Newspaper className="w-5 h-5 text-primary" />
            {symbol} News
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>{error || `No recent news found for ${symbol}`}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchNews}
              className="mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Newspaper className="w-5 h-5 text-primary" />
            {symbol} News & Analysis
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={fetchNews}
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {news.map((article, index) => (
          <div
            key={`${article.url}-${index}`}
            className="p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold leading-tight text-sm">
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
              
              {/* Image */}
              {article.urlToImage && (
                <img 
                  src={article.urlToImage} 
                  alt={article.title}
                  className="w-full h-32 object-cover rounded-md"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              
              {/* Summary */}
              {article.description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {article.description}
                </p>
              )}
              
              {/* Meta Info */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">
                    {article.source.name}
                  </Badge>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(article.publishedAt)}</span>
                  </div>
                </div>
              </div>
              
              {/* Bull/Bear Sentiment */}
              <NewsSentiment newsUrl={article.url} newsTitle={article.title} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default StockNews;