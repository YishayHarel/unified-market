import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

// Force cache refresh

interface NewsArticle {
  title: string;
  description: string;
  source: { name: string };
  publishedAt: string;
  url: string;
  urlToImage?: string;
}

const NewsSection = () => {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [displayedCount, setDisplayedCount] = useState(3);

  const fetchNews = async () => {
    try {
      // Add timeout handling for the client-side call
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
      const fetchPromise = supabase.functions.invoke('get-news', {
        body: { category: 'business', country: 'us', pageSize: 50 }
      });
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) throw error;
      
      if (data?.articles) {
        setNews(data.articles);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      // Set fallback news data instead of empty array
      setNews([{
        title: "Market Update",
        description: "Unable to fetch latest news. Please try refreshing the page.",
        source: { name: "System" },
        publishedAt: new Date().toISOString(),
        url: "#"
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount(prev => {
        if (prev === 3) {
          // First load more: show 10 total (3 + 7)
          return Math.min(10, news.length);
        } else {
          // Subsequent load more: add 10 more each time
          return Math.min(prev + 10, news.length);
        }
      });
      setLoadingMore(false);
    }, 500);
  };

  useEffect(() => {
    fetchNews();
  }, []);

  if (loading) {
    return (
      <section>
        <h2 className="text-2xl font-semibold mb-4">📰 Latest News</h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card p-4 rounded-lg animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-full mb-1"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const displayedNews = news.slice(0, displayedCount);
  const hasMoreNews = displayedCount < news.length;

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">📰 Latest News</h2>
      <div className="space-y-4">
        {displayedNews.map((article, index) => (
          <Card key={`${article.url}-${index}`} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-lg leading-tight">
                  {article.title}
                </CardTitle>
                <Badge variant="secondary" className="shrink-0">
                  {article.source.name}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {article.urlToImage && (
                <img 
                  src={article.urlToImage} 
                  alt={article.title}
                  className="w-full h-48 object-cover rounded-md mb-4"
                />
              )}
              <p className="text-muted-foreground mb-4">
                {article.description}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{article.source.name}</span>
                  <span>•</span>
                  <span>
                    {new Date(article.publishedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a 
                    href={article.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    Read More
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
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