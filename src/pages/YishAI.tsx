import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Clock } from "lucide-react";

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

        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Clock className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Coming Soon</CardTitle>
            <CardDescription className="text-base">
              This feature will be available shortly
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              We're working hard to bring you an AI-powered stock advisor that will provide 
              personalized market insights, portfolio recommendations, and real-time analysis.
            </p>
            <div className="grid gap-3 text-sm text-left max-w-md mx-auto">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span>Personalized stock recommendations</span>
              </div>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span>Advanced market analysis and insights</span>
              </div>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span>Portfolio optimization suggestions</span>
              </div>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span>Real-time market sentiment analysis</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground pt-4">
              Stay tuned for updates!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default YishAI;
