import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import NewsSentiment from "@/components/NewsSentiment";

// Force cache refresh

interface NewsArticle {
  title: string;
  description: string;
  source: { name: string };
  publishedAt: string;
  url: string;
  urlToImage?: string;
  /** Present only on cache-served articles; the live RSS fallback has none. */
  tickers?: string[];
  bullCount?: number;
  bearCount?: number;
}

/**
 * Three was the only setting, and this component is the whole of the News page.
 * A page titled "Market News" opening on three stories, with fifty already
 * fetched and sitting in memory, reads as a broken feed rather than a compact
 * one.
 */
const DEFAULT_INITIAL_COUNT = 12;

const NewsSection = ({ initialCount = DEFAULT_INITIAL_COUNT }: { initialCount?: number }) => {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [displayedCount, setDisplayedCount] = useState(initialCount);

  /** Symbols the signed-in user follows, used to lead the feed with their news. */
  const loadWatchlist = async (): Promise<string[]> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return [];

    const [saved, holdings] = await Promise.all([
      supabase.from('user_saved_stocks').select('symbol').eq('user_id', auth.user.id).limit(50),
      supabase.from('portfolio_holdings').select('symbol').eq('user_id', auth.user.id).limit(50),
    ]);

    const symbols = [
      ...(saved.data ?? []).map((r) => r.symbol),
      ...(holdings.data ?? []).map((r) => r.symbol),
    ].filter(Boolean);

    return [...new Set(symbols)];
  };

  const fetchNews = async () => {
    try {
      // Add timeout handling for the client-side call
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );

      let data: any = null;
      let error: any = null;

      const watchlist = await loadWatchlist().catch(() => []);
      const fetchPromise = supabase.functions.invoke('get-news', {
        body: { category: 'business', country: 'us', pageSize: 50, watchlist },
      });
      const primary = (await Promise.race([fetchPromise, timeoutPromise])) as any;
      if (primary?.error) throw primary.error;
      data = primary?.data;

      if (error) {
        console.error('Supabase function error:', error);
        // Log detailed error for debugging
        if (error.message) console.error('Error message:', error.message);
        if (error.status) console.error('Error status:', error.status);
        throw error;
      }
      
      // Check if we got an error in the response data
      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }
      
      if (data?.articles) {
        setNews(data.articles);
      } else {
        console.warn('No articles in response:', data);
        setNews([]);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      // Log the full error for debugging
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      // Don't show fake data - leave empty to show error state
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount(prev => Math.min(prev + 10, news.length));
      setLoadingMore(false);
    }, 500);
  };

  useEffect(() => {
    fetchNews();
    
    // Auto-refresh news every 5 minutes
    const interval = setInterval(() => {
      console.log('Auto-refreshing news...');
      fetchNews();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
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

  if (news.length === 0) {
    return (
      <section>
        <h2 className="text-2xl font-semibold mb-4">📰 Latest News</h2>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive font-medium">Unable to load news</p>
            <p className="text-muted-foreground text-sm mt-1">Please try again later</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchNews}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">📰 Latest News</h2>
      <div className="space-y-4">
        {displayedNews.map((article, index) => (
          <Card key={`${article.url}-${index}`} className="hover:shadow-md transition-shadow border border-border shadow-sm">
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

              {/* Tickers this story mentions — the reason articles are tagged
                  at ingest, and the link from a headline to the stock page. */}
              {article.tickers && article.tickers.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {article.tickers.slice(0, 6).map((ticker) => (
                    <Link
                      key={ticker}
                      to={`/stock/${ticker}`}
                      className="text-xs font-semibold px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      {ticker}
                    </Link>
                  ))}
                  {(article.bullCount || article.bearCount) ? (
                    <span className="ml-auto text-xs text-muted-foreground">
                      🐂 {article.bullCount ?? 0} · 🐻 {article.bearCount ?? 0}
                    </span>
                  ) : null}
                </div>
              )}
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
                
                {/* Bull/Bear Sentiment */}
                <NewsSentiment newsUrl={article.url} newsTitle={article.title} />
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