// Create Checkout - Creates Stripe checkout session for subscription purchase

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  getCorsHeaders,
  getReturnUrl,
  handleCorsPreflightRequest,
} from "../_shared/cors.ts";

// Valid price IDs - must match exactly for security
const VALID_PRICE_IDS = [
  'price_1SjowV8Eyj3l9vnAJTlpDmKb',
  'price_1Sjox28Eyj3l9vnAzyqtuewV',
  'price_1SjoxF8Eyj3l9vnAdUJ9Iepb',
];

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

function safeErrorResponse(error: unknown, corsHeaders: Record<string, string>): Response {
  console.error("[CREATE-CHECKOUT] Error:", error);

  if (error instanceof Error) {
    const m = error.message;
    if (m.includes("User not authenticated") || m.includes("authorization") || m.includes("not available")) {
      return new Response(JSON.stringify({ error: m }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    if (m.includes("STRIPE") || m.includes("Payment service configuration")) {
      return new Response(JSON.stringify({ error: "Payment service is not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503,
      });
    }
    if (m.includes("Price ID") || m.includes("required") || m.includes("Invalid request")) {
      return new Response(JSON.stringify({ error: m }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    // Stripe client errors (invalid price for account, etc.) — message is usually safe
    if (m.includes("No such price") || m.includes("Stripe") || m.includes("stripe")) {
      return new Response(JSON.stringify({ error: m }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502,
      });
    }
  }

  return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 500,
  });
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(origin);
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

    const stripe = new Stripe(stripeKey);

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found");
    }

    const subscriptionBase = getReturnUrl(origin, "/subscription");

    const session = await stripe.checkout.sessions.create({
      ...(customerId
        ? { customer: customerId }
        : { customer_email: user.email ?? undefined }),
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${subscriptionBase}?success=true`,
      cancel_url: `${subscriptionBase}?canceled=true`,
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
