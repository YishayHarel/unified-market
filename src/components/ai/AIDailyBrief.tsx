import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sun, Clock, Sparkles } from "lucide-react";

const AIDailyBrief = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-yellow-500" />
          AI Daily Brief
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-primary/10">
              <Clock className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h3 className="text-xl font-semibold">Coming Soon</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Get personalized daily market briefings powered by AI. This feature is currently under development.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Personalized insights</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Portfolio analysis</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Market opportunities</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIDailyBrief;
