/**
 * Enforces the AI call allowance a subscriber actually paid for.
 *
 * Every endpoint previously called check_ai_usage with a flat AI_DAILY_LIMIT of
 * 20, identical for all plans — while the pricing page sells 100, 200 and 1000
 * calls a month. That let the cheapest tier spend roughly six times its
 * allowance and capped the most expensive one below what it advertises.
 *
 * Counting is monthly because that is the unit sold.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface UsageResult {
  allowed: boolean;
  used: number;
  limit: number;
}

export async function consumeAiCall(
  supabase: SupabaseClient,
  userId: string,
  monthlyLimit: number,
): Promise<UsageResult | null> {
  const { data, error } = await supabase.rpc("check_ai_usage_monthly", {
    p_user_id: userId,
    p_monthly_limit: monthlyLimit,
  });

  if (error) {
    console.error("[ai-usage] check failed:", error.message);
    return null;
  }

  const result = data as UsageResult;
  if (!result.allowed) {
    console.log(`[ai-usage] ${userId.slice(0, 8)}… at ${result.used}/${result.limit}`);
  }
  return result;
}

/** 429 with the numbers, so the client can show where the user stands. */
export function usageExceededResponse(
  usage: UsageResult,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: `You have used all ${usage.limit} AI calls included this month.`,
      used: usage.used,
      limit: usage.limit,
      upgradeAvailable: true,
    }),
    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
