import { useState, useEffect } from "react";
import { Calendar, TrendingUp, Clock, Building } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface EarningsEvent {
  id: string;
  symbol: string;
  company: string;
  date: string;
  time: string;
  estimate: number;
  previous: number;
  marketCap: string;
}

const EarningsCalendar = () => {
  const [earnings, setEarnings] = useState<EarningsEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data for demonstration
  useEffect(() => {
    const mockEarnings: EarningsEvent[] = [
      {
        id: "1",
        symbol: "AAPL",
        company: "Apple Inc.",
        date: "2024-01-17",
        time: "After Market Close",
        estimate: 2.18,
        previous: 1.88,
        marketCap: "$2.8T"
      },
      {
        id: "2",
        symbol: "GOOGL",
        company: "Alphabet Inc.",
        date: "2024-01-18",
        time: "After Market Close",
        estimate: 1.35,
        previous: 1.05,
        marketCap: "$1.7T"
      },
      {
        id: "3",
        symbol: "TSLA",
        company: "Tesla Inc.",
        date: "2024-01-19",
        time: "After Market Close",
        estimate: 0.86,
        previous: 0.71,
        marketCap: "$790B"
      }
    ];

    setTimeout(() => {
      setEarnings(mockEarnings);
      setLoading(false);
    }, 1200);
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric"
    });
  };

  const getEstimateDirection = (estimate: number, previous: number) => {
    return estimate > previous ? "up" : estimate < previous ? "down" : "flat";
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/50 border-accent/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Earnings Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
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
          <Calendar className="h-5 w-5 text-primary" />
          Earnings Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {earnings.map((event) => {
          const direction = getEstimateDirection(event.estimate, event.previous);
          
          return (
            <div
              key={event.id}
              className="p-4 rounded-lg border bg-gradient-to-r from-background to-muted/20 hover:from-muted/30 hover:to-muted/40 transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <Building className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{event.symbol}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-28">
                      {event.company}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {event.marketCap}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground">Date & Time</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-primary" />
                    <span className="font-medium">{formatDate(event.date)}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">{event.time}</p>
                </div>

                <div>
                  <p className="text-muted-foreground">EPS Estimate</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-semibold text-foreground">
                      ${event.estimate.toFixed(2)}
                    </span>
                    {direction === "up" && (
                      <TrendingUp className="h-3 w-3 text-primary" />
                    )}
                    {direction === "down" && (
                      <TrendingUp className="h-3 w-3 text-destructive rotate-180" />
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Prev: ${event.previous.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        
        <Button variant="outline" className="w-full mt-4">
          View Full Calendar
        </Button>
      </CardContent>
    </Card>
  );
};

export default EarningsCalendar;