import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, TrendingUp, TrendingDown, ExternalLink, RefreshCw, BarChart } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ArticleSummary {
  title: string;
  summary: string;
  url: string;
  source: string;
}

interface MarketAnalysis {
  marketSentiment: string;
  keyThemes: string[];
  majorEvents: Array<{
    event: string;
    impact: string;
    affectedSectors: string[];
  }>;
  stocksInFocus: Array<{
    symbol: string;
    reason: string;
  }>;
  sectorInsights: Record<string, string>;
  riskFactors: string[];
  summary: string;
  confidence: number;
}

interface SummaryData {
  marketAnalysis: MarketAnalysis;
  articleSummaries: ArticleSummary[];
  timestamp: string;
}

const SmartNewsSummarizer = () => {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [newsArticles, setNewsArticles] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchNewsAndSummarize();
  }, []);

  const fetchNewsAndSummarize = async () => {
    setLoading(true);
    try {
      // First fetch news articles
      const { data: newsData, error: newsError } = await supabase.functions.invoke('get-news', {
        body: { pageSize: 15 }
      });

      if (newsError) throw newsError;
      
      if (!newsData?.articles || newsData.articles.length === 0) {
        toast({
          title: "No News Available",
          description: "No recent news articles found to summarize.",
        });
        return;
      }

      setNewsArticles(newsData.articles);

      // Then summarize with AI
      const { data: summaryData, error: summaryError } = await supabase.functions.invoke('smart-news-summarizer', {
        body: { articles: newsData.articles }
      });

      if (summaryError) throw summaryError;
      setSummaryData(summaryData);

      toast({
        title: "Success",
        description: "News analysis complete",
      });
    } catch (error) {
      console.error('Error fetching and summarizing news:', error);
      toast({
        title: "Error",
        description: "Failed to analyze news articles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'bullish':
        return 'text-green-600';
      case 'bearish':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'bullish':
        return <TrendingUp className="h-4 w-4" />;
      case 'bearish':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <BarChart className="h-4 w-4" />;
    }
  };

  const getSentimentBadgeVariant = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'bullish':
        return 'default';
      case 'bearish':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Smart News Summarizer
          </CardTitle>
          <Button
            onClick={fetchNewsAndSummarize}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Analyzing...' : 'Refresh Analysis'}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Sparkles className="h-8 w-8 animate-pulse mx-auto mb-4" />
              <p className="text-muted-foreground">AI is analyzing the latest market news...</p>
            </div>
          ) : !summaryData ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Click "Refresh Analysis" to get the latest market insights</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Market Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Market Overview</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Last updated: {new Date(summaryData.timestamp).toLocaleString()}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Market Sentiment */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Market Sentiment:</span>
                      <Badge variant={getSentimentBadgeVariant(summaryData.marketAnalysis.marketSentiment)}>
                        <div className="flex items-center gap-1">
                          {getSentimentIcon(summaryData.marketAnalysis.marketSentiment)}
                          <span>{summaryData.marketAnalysis.marketSentiment.toUpperCase()}</span>
                        </div>
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Confidence:</span>
                      <div className="flex items-center gap-2">
                        <Progress value={summaryData.marketAnalysis.confidence * 10} className="w-16" />
                        <span className="text-sm font-medium">{summaryData.marketAnalysis.confidence}/10</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm">{summaryData.marketAnalysis.summary}</p>
                  </div>

                  {/* Key Themes */}
                  <div>
                    <h4 className="font-semibold mb-2">Key Themes</h4>
                    <div className="flex flex-wrap gap-2">
                      {summaryData.marketAnalysis.keyThemes.map((theme, index) => (
                        <Badge key={index} variant="outline">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Major Events */}
              {summaryData.marketAnalysis.majorEvents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Major Market Events</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {summaryData.marketAnalysis.majorEvents.map((event, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <h4 className="font-semibold mb-2">{event.event}</h4>
                            <p className="text-sm text-muted-foreground mb-2">{event.impact}</p>
                            {event.affectedSectors.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-xs text-muted-foreground mr-2">Affected sectors:</span>
                                {event.affectedSectors.map((sector, sIndex) => (
                                  <Badge key={sIndex} variant="secondary" className="text-xs">
                                    {sector}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stocks in Focus */}
              {summaryData.marketAnalysis.stocksInFocus.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Stocks in Focus</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {summaryData.marketAnalysis.stocksInFocus.map((stock, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-lg">{stock.symbol}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{stock.reason}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Risk Factors */}
              {summaryData.marketAnalysis.riskFactors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Risk Factors to Watch</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summaryData.marketAnalysis.riskFactors.map((risk, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                          <span className="text-sm">{risk}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Article Summaries */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Key Article Summaries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {summaryData.articleSummaries.map((article, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <h4 className="font-semibold text-sm leading-tight pr-4">
                                {article.title}
                              </h4>
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                {article.source}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{article.summary}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => window.open(article.url, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Read Full Article
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SmartNewsSummarizer;