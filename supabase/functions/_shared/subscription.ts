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
  /** Which plan they are on, when subscribed. */
  tier?: SubscriptionTier;
  /** AI calls their plan includes each month. */
  monthlyAiCalls?: number;
}

export type SubscriptionTier = "basic" | "premium" | "unlimited";

/**
 * Plan entitlements, keyed by Stripe product.
 *
 * These live server-side because they decide what a caller is allowed to spend.
 * The same figures appear on the pricing page, but a limit the client could
 * assert is not a limit. Keep the two in step when pricing changes.
 */
const TIERS: Record<string, { tier: SubscriptionTier; monthlyAiCalls: number }> = {
  prod_ThDN3TeB13Pusx: { tier: "basic", monthlyAiCalls: 100 },
  prod_ThDNk8xTBMxIGN: { tier: "premium", monthlyAiCalls: 200 },
  prod_ThDO59bJiy1UPG: { tier: "unlimited", monthlyAiCalls: 1000 },
};

/** Used when the subscription requirement is switched off entirely. */
const UNGATED_MONTHLY_CALLS = 100;

/**
 * Set AI_REQUIRE_SUBSCRIPTION=false to open the AI features to every
 * authenticated user — useful for a launch period or while testing.
 */
function subscriptionRequired(): boolean {
  return (Deno.env.get("AI_REQUIRE_SUBSCRIPTION") ?? "true") !== "false";
}

export async function checkSubscription(email: string | undefined): Promise<SubscriptionCheck> {
  if (!subscriptionRequired()) {
    return { subscribed: true, monthlyAiCalls: UNGATED_MONTHLY_CALLS };
  }

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

    // Entitlement comes from the Stripe product, so an upgrade or downgrade
    // takes effect the moment billing changes rather than on our next deploy.
    const productId = subscriptions.data[0].items.data[0]?.price?.product;
    const plan = typeof productId === "string" ? TIERS[productId] : undefined;

    if (!plan) {
      // An active subscription on a product we do not recognise: let them in on
      // the smallest plan rather than deny someone who is paying.
      console.warn("[subscription] Unrecognised product:", productId);
      return { subscribed: true, monthlyAiCalls: TIERS.prod_ThDN3TeB13Pusx.monthlyAiCalls };
    }

    return { subscribed: true, tier: plan.tier, monthlyAiCalls: plan.monthlyAiCalls };
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
