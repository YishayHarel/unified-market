import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bot, Clock, Sparkles } from "lucide-react";

const AIStockAdvisor = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          YishAI Stock Advisor
        </CardTitle>
        <CardDescription>
          Get personalized stock market insights and analysis
        </CardDescription>
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
            Chat with an AI-powered stock advisor for personalized insights and analysis. This feature is currently under development.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Conversational AI</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="h-4 w-4 text-primary" />
              <span>Stock recommendations</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Market analysis</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIStockAdvisor;
