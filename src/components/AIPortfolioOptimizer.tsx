import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Clock, Target, PieChart } from "lucide-react";

const AIPortfolioOptimizer = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI Portfolio Optimizer
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
            Get AI-powered portfolio optimization and rebalancing recommendations. This feature is currently under development.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PieChart className="h-4 w-4 text-primary" />
              <span>Diversification analysis</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4 text-primary" />
              <span>Rebalancing suggestions</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4 text-primary" />
              <span>Risk optimization</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIPortfolioOptimizer;
