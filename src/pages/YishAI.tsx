import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Bot, Crown, LogIn } from "lucide-react";
import AIStockAdvisor from "@/components/AIStockAdvisor";

const YishAI = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">
          <header className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Bot className="h-8 w-8 text-primary" />
              <Crown className="h-6 w-6 text-yellow-500" />
            </div>
            <h1 className="text-3xl font-bold">YishAI Stock Advisor</h1>
            <p className="text-muted-foreground mt-2">
              Get personalized stock market insights powered by advanced AI
            </p>
          </header>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">Premium AI Features</CardTitle>
              <CardDescription className="text-center">
                Sign in and subscribe to access our advanced AI stock advisor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm">
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
              
              <div className="pt-4">
                <Button asChild className="w-full">
                  <Link to="/auth" className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign In to Access YishAI
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Bot className="h-8 w-8 text-primary" />
            <Crown className="h-6 w-6 text-yellow-500" />
          </div>
          <h1 className="text-3xl font-bold">YishAI Stock Advisor</h1>
          <p className="text-muted-foreground mt-2">
            Your personal AI-powered stock market consultant
          </p>
        </header>

        <AIStockAdvisor />
      </div>
    </div>
  );
};

export default YishAI;