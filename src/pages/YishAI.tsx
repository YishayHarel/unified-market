import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Clock, Sparkles } from "lucide-react";

const YishAI = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">YishAI Stock Advisor</h1>
          <p className="text-muted-foreground mt-2">
            Your personal AI-powered stock market consultant
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Stock Advisor
              <Badge variant="secondary">Coming Soon</Badge>
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
                Chat with an AI-powered stock advisor for personalized insights, 
                portfolio recommendations, and real-time market analysis. 
                This feature is currently under development.
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Conversational AI</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Bot className="h-4 w-4 text-primary" />
                  <span>Stock Recommendations</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Market Analysis</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Portfolio Optimization</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default YishAI;
