import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, TrendingUp } from "lucide-react";

interface AnalystRatingsProps {
  symbol: string;
}

interface Rating {
  type: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  count: number;
  percentage: number;
  color: string;
}

const AnalystRatings = ({ symbol }: AnalystRatingsProps) => {
  // Mock analyst ratings data
  const ratings: Rating[] = [
    { type: "Strong Buy", count: 12, percentage: 40, color: "bg-green-500" },
    { type: "Buy", count: 8, percentage: 27, color: "bg-green-400" },
    { type: "Hold", count: 7, percentage: 23, color: "bg-yellow-500" },
    { type: "Sell", count: 2, percentage: 7, color: "bg-red-400" },
    { type: "Strong Sell", count: 1, percentage: 3, color: "bg-red-500" }
  ];

  const totalAnalysts = ratings.reduce((sum, rating) => sum + rating.count, 0);
  const avgRating = 4.0; // Mock average rating
  const priceTarget = 185.50; // Mock price target

  const getRatingColor = (type: string) => {
    switch (type) {
      case "Strong Buy": return "text-green-400";
      case "Buy": return "text-green-300";
      case "Hold": return "text-yellow-400";
      case "Sell": return "text-red-400";
      case "Strong Sell": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  const getOverallRating = (avg: number) => {
    if (avg >= 4.0) return { text: "Strong Buy", color: "text-green-400" };
    if (avg >= 3.0) return { text: "Buy", color: "text-green-300" };
    if (avg >= 2.5) return { text: "Hold", color: "text-yellow-400" };
    if (avg >= 2.0) return { text: "Sell", color: "text-red-400" };
    return { text: "Strong Sell", color: "text-red-500" };
  };

  const overallRating = getOverallRating(avgRating);

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Star className="w-5 h-5 text-primary" />
          Analyst Ratings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Rating */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl font-bold">{avgRating.toFixed(1)}</span>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= avgRating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className={`font-medium ${overallRating.color}`}>
            {overallRating.text}
          </div>
          <div className="text-sm text-muted-foreground">
            Based on {totalAnalysts} analyst ratings
          </div>
        </div>

        {/* Price Target */}
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Price Target</span>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <div className="text-xl font-bold text-green-400">
            ${priceTarget.toFixed(2)}
          </div>
          <div className="text-sm text-muted-foreground">
            +{((priceTarget / 175.43 - 1) * 100).toFixed(1)}% upside
          </div>
        </div>

        {/* Rating Breakdown */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Rating Breakdown</h4>
          {ratings.map((rating, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className={getRatingColor(rating.type)}>{rating.type}</span>
                <span className="text-muted-foreground">
                  {rating.count} ({rating.percentage}%)
                </span>
              </div>
              <Progress 
                value={rating.percentage} 
                className="h-2"
              />
            </div>
          ))}
        </div>

        {/* Recent Changes */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Recent Changes</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Goldman Sachs</span>
              <Badge variant="outline" className="text-green-400 border-green-400">
                Upgraded to Buy
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Morgan Stanley</span>
              <Badge variant="outline">
                Price Target: $190
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">JP Morgan</span>
              <Badge variant="outline" className="text-green-400 border-green-400">
                Reiterated Buy
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalystRatings;