import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Crown, Zap, Rocket } from "lucide-react";
import { useAuth, SUBSCRIPTION_TIERS } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";

const Subscription = () => {
  const { user, subscription, subscriptionLoading, checkSubscription } = useAuth();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast({
        title: "Subscription successful!",
        description: "Thank you for subscribing. Your plan is now active.",
      });
      checkSubscription();
    } else if (searchParams.get('canceled') === 'true') {
      toast({
        title: "Subscription canceled",
        description: "You can subscribe anytime.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast, checkSubscription]);

  const handleCheckout = async (priceId: string, tierKey: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setLoadingTier(tierKey);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    } finally {
      setLoadingTier(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const tierIcons = {
    basic: Zap,
    premium: Crown,
    unlimited: Rocket,
  };

  const tierColors = {
    basic: "from-blue-500 to-cyan-500",
    premium: "from-purple-500 to-pink-500",
    unlimited: "from-amber-500 to-orange-500",
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-3xl font-bold">Choose Your Plan</h1>
          <p className="text-muted-foreground mt-2">
            Unlock AI-powered stock insights and recommendations
          </p>
        </header>

        {subscription.subscribed && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Plan</p>
                  <p className="text-xl font-semibold">
                    {subscription.tier ? SUBSCRIPTION_TIERS[subscription.tier].name : 'Unknown'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {subscription.aiCallsLimit} AI calls/month
                  </p>
                  {subscription.subscriptionEnd && (
                    <p className="text-sm text-muted-foreground">
                      Renews: {new Date(subscription.subscriptionEnd).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  variant="outline"
                >
                  {portalLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Manage Subscription'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {(Object.entries(SUBSCRIPTION_TIERS) as [keyof typeof SUBSCRIPTION_TIERS, typeof SUBSCRIPTION_TIERS[keyof typeof SUBSCRIPTION_TIERS]][]).map(([key, tier]) => {
            const Icon = tierIcons[key];
            const isCurrentPlan = subscription.tier === key;
            const gradientClass = tierColors[key];

            return (
              <Card
                key={key}
                className={`relative overflow-hidden transition-all hover:shadow-lg ${
                  isCurrentPlan ? 'ring-2 ring-primary' : ''
                }`}
              >
                {isCurrentPlan && (
                  <Badge className="absolute top-4 right-4 bg-primary">
                    Your Plan
                  </Badge>
                )}
                <div className={`h-2 bg-gradient-to-r ${gradientClass}`} />
                <CardHeader className="text-center pt-6">
                  <div className={`mx-auto mb-4 p-3 rounded-full bg-gradient-to-r ${gradientClass} text-white w-fit`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">${tier.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{tier.aiCallsPerMonth} AI calls per month</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>AI stock recommendations</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Portfolio optimization</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Smart news summaries</span>
                    </li>
                  </ul>
                  <Button
                    className="w-full"
                    onClick={() => handleCheckout(tier.price_id, key)}
                    disabled={loadingTier !== null || isCurrentPlan || subscriptionLoading}
                    variant={isCurrentPlan ? "secondary" : "default"}
                  >
                    {loadingTier === key ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : subscription.subscribed ? (
                      'Switch Plan'
                    ) : (
                      'Get Started'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {!user && (
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-4">
                Sign in to subscribe and unlock AI features
              </p>
              <Button onClick={() => navigate('/auth')}>
                Sign In
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Subscription;
