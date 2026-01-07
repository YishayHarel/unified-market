import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { analytics } from '@/hooks/useAnalytics';
import { 
  checkAuthRateLimit, 
  recordFailedAttempt, 
  clearRateLimit, 
  getRateLimitMessage 
} from '@/lib/authRateLimit';
import {
  initSessionManager,
  cleanupSessionManager,
  extendSession,
  getRemainingSessionTime
} from '@/lib/sessionManager';

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
    // Return a safe default during initial render before provider mounts
    console.warn('useAuth called outside AuthProvider, returning default state');
    return {
      user: null,
      session: null,
      loading: true,
      subscription: { subscribed: false, tier: null, subscriptionEnd: null, aiCallsLimit: 0 },
      subscriptionLoading: false,
      signUp: async () => ({ error: new Error('Auth not initialized') }),
      signIn: async () => ({ error: new Error('Auth not initialized') }),
      signOut: async () => {},
      checkSubscription: async () => {},
    } as AuthContextType;
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

  // Session expiry warning handler
  const handleSessionWarning = useCallback((remainingMs: number) => {
    const minutes = Math.ceil(remainingMs / 60000);
    toast({
      title: "Session expiring soon",
      description: `Your session will expire in ${minutes} minute(s) due to inactivity. Click anywhere to stay logged in.`,
      duration: 10000,
    });
  }, [toast]);

  // Session expired handler
  const handleSessionExpired = useCallback(() => {
    toast({
      title: "Session expired",
      description: "You have been logged out due to inactivity.",
      variant: "destructive",
    });
  }, [toast]);

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
          
          // Initialize session manager for timeout tracking
          initSessionManager({
            onSessionExpired: handleSessionExpired,
            onSessionWarning: handleSessionWarning,
          });
        }
        
        if (event === 'SIGNED_OUT') {
          analytics.userAction('sign_out');
          setSubscription({
            subscribed: false,
            tier: null,
            subscriptionEnd: null,
            aiCallsLimit: 0,
          });
          // Cleanup session manager
          cleanupSessionManager();
        }
        
        if (event === 'TOKEN_REFRESHED') {
          console.log('[AuthContext] Token refreshed successfully');
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Initialize session manager if already logged in
      if (session) {
        initSessionManager({
          onSessionExpired: handleSessionExpired,
          onSessionWarning: handleSessionWarning,
        });
      }
    });

    return () => {
      authSubscription.unsubscribe();
      cleanupSessionManager();
    };
  }, [toast, handleSessionExpired, handleSessionWarning]);

  // Check subscription when session changes
  useEffect(() => {
    if (session) {
      checkSubscription();
    }
  }, [session]);

  // Periodic subscription check (every 5 minutes - optimized from 1 minute)
  useEffect(() => {
    if (!session) return;
    
    const interval = setInterval(() => {
      checkSubscription();
    }, 5 * 60 * 1000); // 5 minutes instead of 1 minute

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
    // Check rate limit before attempting sign in
    const rateLimitStatus = checkAuthRateLimit(email);
    const warningMessage = getRateLimitMessage(rateLimitStatus);
    
    if (!rateLimitStatus.allowed) {
      toast({
        title: "Too many attempts",
        description: warningMessage || "Please try again later.",
        variant: "destructive",
      });
      return { error: new Error(warningMessage || "Rate limited") };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Record failed attempt
      recordFailedAttempt(email);
      
      // Get updated status for warning
      const updatedStatus = checkAuthRateLimit(email);
      const attemptWarning = getRateLimitMessage(updatedStatus);
      
      toast({
        title: "Sign in failed",
        description: attemptWarning 
          ? `${error.message}. ${attemptWarning}` 
          : error.message,
        variant: "destructive",
      });
    } else {
      // Clear rate limit on success
      clearRateLimit(email);
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
