import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Clock, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const YishAI = () => {
  const navigate = useNavigate();
  const { subscription } = useAuth();

  // If user has an active subscription, show the AI interface (coming soon for now)
  if (subscription.subscribed) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">
          <header className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">AI Stock Advisor</h1>
            <p className="text-muted-foreground mt-2">
              {subscription.tier ? `${subscription.aiCallsLimit} AI calls/month` : 'Your personal AI-powered stock market consultant'}
            </p>
          </header>

          <Card className="border-primary/20">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-primary/10">
                  <Clock className="h-12 w-12 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl">AI Features Coming Soon</CardTitle>
              <CardDescription className="text-base">
                Your subscription is active! AI features are being finalized.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                We're putting the finishing touches on your AI-powered stock advisor. 
                You'll have access to all features as soon as they're ready.
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
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">AI Stock Advisor</h1>
          <p className="text-muted-foreground mt-2">
            Your personal AI-powered stock market consultant
          </p>
        </header>

        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-primary/10">
                <CreditCard className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Subscription Required</CardTitle>
            <CardDescription className="text-base">
              Unlock AI-powered insights with a subscription
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Get access to an AI-powered stock advisor that provides 
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
            <Button 
              onClick={() => navigate('/subscription')} 
              size="lg"
              className="mt-6"
            >
              View Subscription Plans
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default YishAI;
