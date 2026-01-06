/**
 * CHECK-SUBSCRIPTION EDGE FUNCTION
 * ================================
 * This Supabase Edge Function verifies if a user has an active Stripe subscription.
 * It's called by the frontend on login, page load, and periodically to keep
 * subscription state in sync.
 * 
 * Flow:
 * 1. Authenticate the user via JWT token
 * 2. Look up the user's email in Stripe's customer database
 * 3. Check if that customer has any active subscriptions
 * 4. Return subscription status, tier, and expiration date
 * 
 * Security measures:
 * - CORS restricted to allowed origins only
 * - JWT token validation via Supabase Auth
 * - Sensitive data (emails, tokens) redacted from logs
 * - Product ID validation to prevent spoofing
 * - Generic error messages returned to client (detailed errors logged server-side)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Valid Stripe product IDs for our subscription tiers.
 * These are verified against incoming subscription data to prevent
 * users from spoofing subscription tiers.
 */
const VALID_PRODUCT_IDS = [
  'prod_ThDN3TeB13Pusx', // Basic tier - 100 AI calls/month
  'prod_ThDNk8xTBMxIGN', // Premium tier - 500 AI calls/month
  'prod_ThDO59bJiy1UPG', // Unlimited tier - unlimited AI calls
];

/**
 * Allowed origins for CORS (Cross-Origin Resource Sharing).
 * Only requests from these domains will be accepted.
 * This prevents unauthorized websites from calling our API.
 */
const ALLOWED_ORIGINS = [
  'https://85a34aed-b2cd-4a8b-8664-ff1b782adf81.lovableproject.com',
  'https://lovable.dev',
  'http://localhost:8080',
  'http://localhost:5173'
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generates CORS headers based on the request origin.
 * If the origin is in our allowed list, we echo it back.
 * Otherwise, we default to the first allowed origin.
 * 
 * @param origin - The Origin header from the incoming request
 * @returns Object containing CORS headers
 */
function getCorsHeaders(origin: string | null): Record<string, string> {
  // Check if the request origin matches any of our allowed origins
  const allowedOrigin = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o.replace(/\/$/, ''))) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

/**
 * Structured logging helper for debugging.
 * Automatically redacts sensitive information (keys, tokens, emails)
 * to prevent accidental exposure in logs.
 * 
 * @param step - Description of the current step in the process
 * @param details - Optional object with additional context (will be sanitized)
 */
const logStep = (step: string, details?: any) => {
  // List of sensitive field names that should never appear in logs
  const sensitiveFields = ['key', 'token', 'secret', 'email', 'password'];
  
  // Sanitize the details object by redacting sensitive fields
  const safeDetails = details ? Object.fromEntries(
    Object.entries(details).map(([k, v]) => [
      k,
      sensitiveFields.some(field => k.toLowerCase().includes(field))
        ? '[REDACTED]' 
        : v
    ])
  ) : undefined;
  
  const detailsStr = safeDetails ? ` - ${JSON.stringify(safeDetails)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

/**
 * Creates a safe error response that doesn't leak internal details.
 * Only "operational" errors (auth-related) are shown to the user.
 * All other errors return a generic message while logging the full error server-side.
 * 
 * This prevents attackers from gaining information about our system
 * through error messages.
 * 
 * @param error - The caught error object
 * @param corsHeaders - CORS headers to include in the response
 * @returns Response object with appropriate error message
 */
function safeErrorResponse(error: unknown, corsHeaders: Record<string, string>): Response {
  // Determine if this is a user-facing error (auth issues)
  const isOperational = error instanceof Error && (
    error.message.includes('Authentication') ||
    error.message.includes('authorization') ||
    error.message.includes('authenticated')
  );
  
  // Only expose operational errors; everything else gets a generic message
  const message = isOperational && error instanceof Error
    ? error.message 
    : 'An error occurred checking your subscription';
  
  // Always log the full error for debugging purposes
  console.error('[CHECK-SUBSCRIPTION] Error:', error);
  
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 400,
  });
}

// ============================================================================
// MAIN REQUEST HANDLER
// ============================================================================

/**
 * Main edge function handler.
 * Processes incoming requests to check subscription status.
 */
serve(async (req) => {
  // Get the origin for CORS handling
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests (browser sends OPTIONS before actual request)
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client with service role key for admin access
  // This allows us to verify JWT tokens from any user
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } } // Don't persist auth state between requests
  );

  try {
    logStep("Function started");

    // ========================================================================
    // STEP 1: Verify Stripe configuration
    // ========================================================================
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error('[CHECK-SUBSCRIPTION] STRIPE_SECRET_KEY not configured');
      throw new Error("Payment service configuration error");
    }
    logStep("Stripe key verified");

    // ========================================================================
    // STEP 2: Authenticate the user via JWT token
    // ========================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    // Extract the JWT token from "Bearer <token>" format
    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user");
    
    // Verify the token and get the user's information
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id });

    // ========================================================================
    // STEP 3: Look up the user in Stripe by email
    // ========================================================================
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    // If no Stripe customer exists, user has never subscribed
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer");

    // ========================================================================
    // STEP 4: Check for active subscriptions
    // ========================================================================
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
      
      // SECURITY: Verify the product ID is one of our valid products
      // This prevents users from somehow associating invalid products
      if (!VALID_PRODUCT_IDS.includes(rawProductId)) {
        console.error('[CHECK-SUBSCRIPTION] Invalid product ID from Stripe:', rawProductId);
        // Don't reveal that we detected fraud - just treat as unsubscribed
        return new Response(JSON.stringify({ subscribed: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      // SECURITY: Double-check that the subscription hasn't expired
      // (Stripe's "active" filter should handle this, but we verify anyway)
      const endTimestamp = subscription.current_period_end * 1000;
      if (endTimestamp < Date.now()) {
        logStep("Subscription period has expired");
        return new Response(JSON.stringify({ subscribed: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      // Subscription is valid - extract the details
      subscriptionEnd = new Date(endTimestamp).toISOString();
      productId = rawProductId;
      priceId = subscription.items.data[0].price.id;
      logStep("Active subscription verified", { subscriptionId: subscription.id });
    } else {
      logStep("No active subscription found");
    }

    // ========================================================================
    // STEP 5: Return the subscription status to the frontend
    // ========================================================================
    return new Response(JSON.stringify({
      subscribed: hasActiveSub,      // Boolean: does user have active subscription?
      product_id: productId,          // Which tier (product) they're subscribed to
      price_id: priceId,              // The specific price they're paying
      subscription_end: subscriptionEnd // When their current period ends (ISO date)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error) {
    // Return a safe error response that doesn't leak internal details
    return safeErrorResponse(error, corsHeaders);
  }
});
