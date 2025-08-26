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
  const [mockNews] = useState([
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
    }
  ]);

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

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">📰 Latest News</h2>
      <div className="space-y-4">
        {mockNews.map((article, index) => (
          <div key={index} className="pb-4 border-b border-border last:border-b-0">
            <a href="#" className="text-blue-400 hover:underline font-medium">
              {article.title}
            </a>
            <div className="text-sm text-muted-foreground mt-1">
              {article.source} • {article.time}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default NewsSection;