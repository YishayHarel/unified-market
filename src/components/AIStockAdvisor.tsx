import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Bot, RotateCcw } from 'lucide-react';
import { analytics } from '@/hooks/useAnalytics';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AIStockAdvisor = () => {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const currentMessage = message.trim();
    
    // Track AI usage
    analytics.featureUsage('ai_stock_advisor', {
      messageLength: currentMessage.length,
      conversationLength: conversationHistory.length + 1,
      timestamp: new Date().toISOString()
    });

    setIsLoading(true);
    try {
      console.log('Sending message to AI advisor:', currentMessage);
      
      // Build conversation for context
      const fullConversation = [...conversationHistory, { role: 'user' as const, content: currentMessage }];

      const { data, error } = await supabase.functions.invoke('ai-stock-advisor', {
        body: { 
          message: currentMessage,
          conversationHistory: fullConversation 
        }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Update conversation history and show response
      const newConversation = [...fullConversation, { role: 'assistant' as const, content: data.response }];
      setConversationHistory(newConversation);
      setResponse(data.response);
      setMessage(''); // Clear input after successful response

      toast({
        title: "YishAI Response",
        description: "Your stock market analysis is ready",
      });

    } catch (error: any) {
      console.error('Error calling AI advisor:', error);
      
      let errorMessage = "Failed to get AI response";
      if (error.message?.includes("User not authenticated")) {
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

  const startNewConversation = () => {
    setConversationHistory([]);
    setResponse('');
    setMessage('');
    toast({
      title: "New Conversation",
      description: "Started fresh conversation with YishAI",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                YishAI Stock Advisor
              </CardTitle>
              <CardDescription>
                Get personalized stock market insights and analysis. Ask follow-up questions to continue the conversation!
                {conversationHistory.length > 0 && (
                  <span className="block mt-1 text-xs text-muted-foreground">
                    Conversation context: {Math.floor(conversationHistory.length / 2)} exchanges
                  </span>
                )}
              </CardDescription>
            </div>
            {conversationHistory.length > 0 && (
              <Button variant="outline" size="sm" onClick={startNewConversation}>
                <RotateCcw className="h-4 w-4 mr-1" />
                New Topic
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Textarea
                placeholder={conversationHistory.length > 0 
                  ? "Ask a follow-up question or explore a new topic..." 
                  : "Ask about stocks, market trends, portfolio advice, or any investment-related question..."
                }
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="min-h-[100px]"
                disabled={isLoading}
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
              ) : conversationHistory.length > 0 ? (
                'Continue Conversation'
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
                  YishAI Analysis
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