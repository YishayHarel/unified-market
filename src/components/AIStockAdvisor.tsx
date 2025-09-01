import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Bot, Crown } from 'lucide-react';

const AIStockAdvisor = () => {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsLoading(true);
    try {
      console.log('Sending message to AI advisor:', message);
      
      const { data, error } = await supabase.functions.invoke('ai-stock-advisor', {
        body: { message: message.trim() }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResponse(data.response);
      toast({
        title: "AI Response Generated",
        description: "Your stock market analysis is ready",
      });

    } catch (error: any) {
      console.error('Error calling AI advisor:', error);
      
      let errorMessage = "Failed to get AI response";
      if (error.message?.includes("Premium subscription required")) {
        errorMessage = "You need a premium subscription to access AI features";
      } else if (error.message?.includes("User not authenticated")) {
        errorMessage = "Please sign in to use AI features";
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI Stock Advisor
            <Crown className="h-4 w-4 text-yellow-500" />
          </CardTitle>
          <CardDescription>
            Get personalized stock market insights and analysis powered by AI. Premium feature for subscribers only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Textarea
                placeholder="Ask about stocks, market trends, portfolio advice, or any investment-related question..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="min-h-[100px]"
              />
            </div>
            <Button 
              type="submit" 
              disabled={!message.trim() || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting AI Analysis...
                </>
              ) : (
                'Get AI Analysis'
              )}
            </Button>
          </form>

          {response && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {response}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AIStockAdvisor;