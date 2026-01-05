import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Valid product IDs for subscription verification
const VALID_PRODUCT_IDS = [
  'prod_ThDN3TeB13Pusx', // basic
  'prod_ThDNk8xTBMxIGN', // premium
  'prod_ThDO59bJiy1UPG', // unlimited
];

// CORS configuration - restrict to allowed origins
const ALLOWED_ORIGINS = [
  'https://85a34aed-b2cd-4a8b-8664-ff1b782adf81.lovableproject.com',
  'https://lovable.dev',
  'http://localhost:8080',
  'http://localhost:5173'
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o.replace(/\/$/, ''))) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const logStep = (step: string, details?: any) => {
  // Sanitize details to avoid logging sensitive data
  const safeDetails = details ? Object.fromEntries(
    Object.entries(details).map(([k, v]) => [
      k,
      k.includes('key') || k.includes('token') || k.includes('secret') || k.includes('email')
        ? '[REDACTED]' 
        : v
    ])
  ) : undefined;
  const detailsStr = safeDetails ? ` - ${JSON.stringify(safeDetails)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Safe error response - never expose internal details
function safeErrorResponse(error: unknown, corsHeaders: Record<string, string>): Response {
  const isOperational = error instanceof Error && (
    error.message.includes('Authentication') ||
    error.message.includes('authorization') ||
    error.message.includes('authenticated')
  );
  
  const message = isOperational && error instanceof Error
    ? error.message 
    : 'An error occurred checking your subscription';
  
  // Log full error for debugging
  console.error('[CHECK-SUBSCRIPTION] Error:', error);
  
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 400,
  });
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error('[CHECK-SUBSCRIPTION] STRIPE_SECRET_KEY not configured');
      throw new Error("Payment service configuration error");
    }
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer");

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;
    let priceId = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      const rawProductId = subscription.items.data[0].price.product as string;
      
      // BUSINESS LOGIC: Verify product ID is valid before trusting it
      if (!VALID_PRODUCT_IDS.includes(rawProductId)) {
        console.error('[CHECK-SUBSCRIPTION] Invalid product ID from Stripe:', rawProductId);
        // Don't expose that we detected an invalid product - just treat as unsubscribed
        return new Response(JSON.stringify({ subscribed: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      // BUSINESS LOGIC: Verify subscription hasn't actually expired
      const endTimestamp = subscription.current_period_end * 1000;
      if (endTimestamp < Date.now()) {
        logStep("Subscription period has expired");
        return new Response(JSON.stringify({ subscribed: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      subscriptionEnd = new Date(endTimestamp).toISOString();
      productId = rawProductId;
      priceId = subscription.items.data[0].price.id;
      logStep("Active subscription verified", { subscriptionId: subscription.id });
    } else {
      logStep("No active subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      price_id: priceId,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return safeErrorResponse(error, corsHeaders);
  }
});
