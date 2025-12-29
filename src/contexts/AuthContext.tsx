import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { analytics } from '@/hooks/useAnalytics';

// Subscription tiers configuration
export const SUBSCRIPTION_TIERS = {
  basic: {
    name: 'Basic Plan',
    price_id: 'price_1SjowV8Eyj3l9vnAJTlpDmKb',
    product_id: 'prod_ThDN3TeB13Pusx',
    price: 8.99,
    aiCallsPerMonth: 100,
  },
  premium: {
    name: 'Premium Plan',
    price_id: 'price_1Sjox28Eyj3l9vnAzyqtuewV',
    product_id: 'prod_ThDNk8xTBMxIGN',
    price: 19.99,
    aiCallsPerMonth: 200,
  },
  unlimited: {
    name: 'Unlimited Plan',
    price_id: 'price_1SjoxF8Eyj3l9vnAdUJ9Iepb',
    product_id: 'prod_ThDO59bJiy1UPG',
    price: 99.99,
    aiCallsPerMonth: 1000,
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS | null;

interface SubscriptionStatus {
  subscribed: boolean;
  tier: SubscriptionTier;
  subscriptionEnd: string | null;
  aiCallsLimit: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  subscription: SubscriptionStatus;
  subscriptionLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  checkSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

const getTierFromProductId = (productId: string | null): SubscriptionTier => {
  if (!productId) return null;
  for (const [tier, config] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (config.product_id === productId) {
      return tier as SubscriptionTier;
    }
  }
  return null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    subscribed: false,
    tier: null,
    subscriptionEnd: null,
    aiCallsLimit: 0,
  });
  const { toast } = useToast();

  const checkSubscription = async () => {
    if (!session) {
      setSubscription({
        subscribed: false,
        tier: null,
        subscriptionEnd: null,
        aiCallsLimit: 0,
      });
      return;
    }

    setSubscriptionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        return;
      }

      const tier = getTierFromProductId(data?.product_id);
      const aiCallsLimit = tier ? SUBSCRIPTION_TIERS[tier].aiCallsPerMonth : 0;

      setSubscription({
        subscribed: data?.subscribed || false,
        tier,
        subscriptionEnd: data?.subscription_end || null,
        aiCallsLimit,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (event === 'SIGNED_IN') {
          analytics.setUserId(session?.user?.id || '');
          analytics.userAction('sign_in', { method: 'email' });
          toast({
            title: "Welcome back!",
            description: "You have been signed in successfully.",
          });
          // Check subscription after sign in
          setTimeout(() => checkSubscription(), 100);
        }
        
        if (event === 'SIGNED_OUT') {
          analytics.userAction('sign_out');
          setSubscription({
            subscribed: false,
            tier: null,
            subscriptionEnd: null,
            aiCallsLimit: 0,
          });
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => authSubscription.unsubscribe();
  }, [toast]);

  // Check subscription when session changes
  useEffect(() => {
    if (session) {
      checkSubscription();
    }
  }, [session]);

  // Periodic subscription check (every minute)
  useEffect(() => {
    if (!session) return;
    
    const interval = setInterval(() => {
      checkSubscription();
    }, 60000);

    return () => clearInterval(interval);
  }, [session]);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Check your email!",
        description: "We sent you a confirmation link.",
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    }

    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
    }
  };

  const value = {
    user,
    session,
    loading,
    subscription,
    subscriptionLoading,
    signUp,
    signIn,
    signOut,
    checkSubscription,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
