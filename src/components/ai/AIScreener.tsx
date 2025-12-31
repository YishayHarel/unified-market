import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Clock, Search } from "lucide-react";

const AIScreener = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Stock Screener
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
            Search for stocks using natural language queries. This feature is currently under development.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Search className="h-4 w-4 text-primary" />
              <span>Natural language search</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>AI-powered filtering</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Smart recommendations</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIScreener;
