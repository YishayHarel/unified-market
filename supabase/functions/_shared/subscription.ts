/**
 * Subscriber gate for the AI endpoints.
 *
 * AI calls cost real money per token, so access is tied to a paying
 * subscription rather than to having signed up. That keeps spend proportional
 * to revenue instead of to registrations.
 *
 * Subscription state is read from Stripe directly rather than from a local
 * mirror. It adds a few hundred milliseconds to calls that already take
 * seconds, and in exchange a cancelled subscription stops working immediately
 * instead of at the end of a cache window.
 */

import Stripe from "https://esm.sh/stripe@18.5.0";

export interface SubscriptionCheck {
  subscribed: boolean;
  /** Populated when not subscribed, safe to show the user. */
  reason?: string;
}

/**
 * Set AI_REQUIRE_SUBSCRIPTION=false to open the AI features to every
 * authenticated user — useful for a launch period or while testing.
 */
function subscriptionRequired(): boolean {
  return (Deno.env.get("AI_REQUIRE_SUBSCRIPTION") ?? "true") !== "false";
}

export async function checkSubscription(email: string | undefined): Promise<SubscriptionCheck> {
  if (!subscriptionRequired()) return { subscribed: true };

  if (!email) {
    return { subscribed: false, reason: "No email on account" };
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    // Fail closed. An unconfigured billing key must not silently hand out paid
    // features — that would be the expensive direction to get wrong.
    console.error("[subscription] STRIPE_SECRET_KEY not configured");
    return { subscribed: false, reason: "Billing is not configured" };
  }

  try {
    const stripe = new Stripe(stripeKey);
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      return { subscribed: false, reason: "No subscription found" };
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customers.data[0].id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return { subscribed: false, reason: "No active subscription" };
    }

    return { subscribed: true };
  } catch (error) {
    console.error(
      "[subscription] Stripe lookup failed:",
      error instanceof Error ? error.message : error,
    );
    // Also fail closed: an outage at Stripe should not open the paid tier.
    return { subscribed: false, reason: "Could not verify subscription" };
  }
}

/** 402 tells the client to show the upgrade path rather than an error. */
export function subscriptionRequiredResponse(
  check: SubscriptionCheck,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: "AI features require an active subscription",
      reason: check.reason,
      upgradeRequired: true,
    }),
    { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
