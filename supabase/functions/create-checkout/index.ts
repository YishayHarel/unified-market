// Create Checkout - Creates Stripe checkout session for subscription purchase

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Valid price IDs - must match exactly for security
const VALID_PRICE_IDS = [
  'price_1SjowV8Eyj3l9vnAJTlpDmKb',
  'price_1Sjox28Eyj3l9vnAzyqtuewV',
  'price_1SjoxF8Eyj3l9vnAdUJ9Iepb',
];

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://85a34aed-b2cd-4a8b-8664-ff1b782adf81.lovableproject.com',
  'https://lovable.dev',
  'http://localhost:8080',
  'http://localhost:5173'
];

// Returns CORS headers based on origin
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

// Logs with redacted sensitive data
const logStep = (step: string, details?: any) => {
  const safeDetails = details ? Object.fromEntries(
    Object.entries(details).map(([k, v]) => [
      k,
      k.includes('key') || k.includes('token') || k.includes('secret') ? '[REDACTED]' : v
    ])
  ) : undefined;
  const detailsStr = safeDetails ? ` - ${JSON.stringify(safeDetails)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// Returns safe error without leaking internals
function safeErrorResponse(error: unknown, corsHeaders: Record<string, string>): Response {
  const isOperational = error instanceof Error && (
    error.message.includes('Price ID') ||
    error.message.includes('User not authenticated') ||
    error.message.includes('required')
  );
  
  const message = isOperational && error instanceof Error
    ? error.message 
    : 'An error occurred processing your request';
  
  console.error('[CREATE-CHECKOUT] Error:', error);
  
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 400,
  });
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");
    
    // Parse and validate request body
    let body: { priceId?: string };
    try {
      body = await req.json();
    } catch {
      throw new Error("Invalid request body");
    }

    const { priceId } = body;
    
    // Validate priceId is known
    if (!priceId || typeof priceId !== 'string') {
      throw new Error("Price ID is required");
    }
    
    if (!VALID_PRICE_IDS.includes(priceId)) {
      logStep("Invalid price ID attempted", { priceId });
      throw new Error("Invalid Price ID");
    }
    logStep("Price ID validated", { priceId });

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("User not authenticated");
    
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !data.user?.email) {
      throw new Error("User not authenticated or email not available");
    }
    
    const user = data.user;
    logStep("User authenticated", { userId: user.id });

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error('[CREATE-CHECKOUT] STRIPE_SECRET_KEY not configured');
      throw new Error("Payment service configuration error");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find or create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found");
    }

    // Build return URL from allowed origins only
    const returnOrigin = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o.replace(/\/$/, '')))
      ? origin
      : ALLOWED_ORIGINS[0];

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${returnOrigin}/subscription?success=true`,
      cancel_url: `${returnOrigin}/subscription?canceled=true`,
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return safeErrorResponse(error, corsHeaders);
  }
});
