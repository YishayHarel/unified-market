// Evaluates the price alerts people have set, and emails the ones that fire.
//
// This function existed but nothing ever called it. It demanded a user JWT and
// checked only that caller's alerts, so it could only have run while someone
// had the site open — and no page invoked it, so it never ran at all. The
// screen promised "get notified when a stock you follow hits your target" and
// every alert ever created sat inert.
//
// It is now a scheduled job: cron calls it with the shared secret, it walks
// every active alert across all users, and it delivers by email through Resend,
// which already works for auth mail. Email is the point — a browser
// notification only arrives if the tab is open, which is exactly when the
// person did not need telling.
//
// Prices come from Yahoo rather than Twelve Data. The old code asked Twelve
// Data for average volume; with no key configured it returned "API key not
// configured" and reported success. Yahoo is keyless, has no daily quota, and
// its daily bars give the average volume directly.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

interface Alert {
  id: string;
  symbol: string;
  alert_type: string;
  target_price: number | null;
  user_id: string;
  message: string | null;
}

interface Quote {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
}

/** Alert types this job can evaluate from a quote. The rest are placeholders. */
const EVALUABLE = new Set(["price_above", "price_below", "percent_up", "percent_down", "volume_spike"]);

/** How many symbols to have in flight at once, so one slow fetch is not serial. */
const CONCURRENCY = 6;

/**
 * Price, today's move, and the volume baseline, from one Yahoo call.
 *
 * Three months of daily bars is enough for a stable average without letting a
 * single quiet week distort it.
 */
async function fetchQuote(symbol: string): Promise<Quote | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; UnifiedMarket/1.0)" } },
    );
    if (!response.ok) return null;

    const result = (await response.json())?.chart?.result?.[0];
    const meta = result?.meta;
    const price = Number(meta?.regularMarketPrice);
    if (!Number.isFinite(price) || price <= 0) return null;

    const previousClose = Number(meta?.chartPreviousClose ?? meta?.previousClose);
    const changePercent =
      Number.isFinite(previousClose) && previousClose > 0
        ? ((price - previousClose) / previousClose) * 100
        : 0;

    const volumes: number[] = (result?.indicators?.quote?.[0]?.volume ?? [])
      .filter((v: unknown) => typeof v === "number" && v > 0) as number[];

    // The last bar is today, which is the volume being compared, not part of
    // the baseline it is compared against.
    const baseline = volumes.slice(0, -1);
    const avgVolume = baseline.length > 0
      ? baseline.reduce((sum, v) => sum + v, 0) / baseline.length
      : 0;

    return {
      symbol,
      price,
      changePercent,
      volume: Number(meta?.regularMarketVolume) || volumes[volumes.length - 1] || 0,
      avgVolume,
    };
  } catch (error) {
    console.error(`[check-alerts] quote failed for ${symbol}:`, (error as Error).message);
    return null;
  }
}

async function fetchQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const quotes = new Map<string, Quote>();
  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const batch = await Promise.all(symbols.slice(i, i + CONCURRENCY).map(fetchQuote));
    for (const quote of batch) {
      if (quote) quotes.set(quote.symbol, quote);
    }
  }
  return quotes;
}

function isTriggered(alert: Alert, quote: Quote): boolean {
  const target = alert.target_price;
  if (target == null || !Number.isFinite(Number(target))) return false;
  const value = Number(target);

  switch (alert.alert_type) {
    case "price_above":
      return quote.price >= value;
    case "price_below":
      return quote.price <= value;
    case "percent_up":
      return quote.changePercent >= value;
    case "percent_down":
      return quote.changePercent <= -value;
    case "volume_spike":
      return quote.avgVolume > 0 && quote.volume / quote.avgVolume >= value;
    default:
      return false;
  }
}

function describe(alert: Alert, quote: Quote): string {
  const target = Number(alert.target_price);
  switch (alert.alert_type) {
    case "price_above":
      return `${alert.symbol} reached $${quote.price.toFixed(2)}, above your $${target} target.`;
    case "price_below":
      return `${alert.symbol} fell to $${quote.price.toFixed(2)}, below your $${target} target.`;
    case "percent_up":
      return `${alert.symbol} is up ${quote.changePercent.toFixed(2)}% today, past your ${target}% mark.`;
    case "percent_down":
      return `${alert.symbol} is down ${Math.abs(quote.changePercent).toFixed(2)}% today, past your ${target}% mark.`;
    case "volume_spike":
      return `${alert.symbol} has traded ${(quote.volume / quote.avgVolume).toFixed(1)}x its average volume today.`;
    default:
      return `${alert.symbol} is at $${quote.price.toFixed(2)}.`;
  }
}

function emailHtml(symbol: string, headline: string, note: string | null, siteUrl: string): string {
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;
                margin:0 auto;padding:32px 24px;color:#111827;">
      <h1 style="font-size:20px;margin:0 0 16px;">📈 UnifiedMarket</h1>
      <h2 style="font-size:17px;margin:0 0 12px;font-weight:600;">${symbol} hit your alert</h2>
      <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 16px;">${headline}</p>
      ${note ? `<p style="font-size:14px;line-height:1.6;color:#6b7280;margin:0 0 24px;">${note}</p>` : ""}
      <a href="${siteUrl}/stock/${symbol}" style="display:inline-block;background:#10b981;color:#ffffff;
         padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        View ${symbol}
      </a>
      <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;line-height:1.6;">
        This alert has now been marked as triggered and will not repeat.
        Manage your alerts in Settings.
      </p>
    </div>`;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Cron-only. Alerts belong to every user, so this runs with the service role
  // and must never be reachable by an ordinary caller.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: alerts, error } = await supabase
      .from("watchlist_alerts")
      .select("id, user_id, symbol, alert_type, target_price, message")
      .eq("is_active", true)
      .is("triggered_at", null)
      .in("alert_type", [...EVALUABLE]);

    if (error) throw error;

    if (!alerts || alerts.length === 0) {
      return new Response(JSON.stringify({ checked: 0, triggered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const symbols = [...new Set((alerts as Alert[]).map((a) => a.symbol))];
    const quotes = await fetchQuotes(symbols);
    console.log(`[check-alerts] ${alerts.length} alerts, ${quotes.size}/${symbols.length} symbols priced`);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("AUTH_EMAIL_FROM") ?? "UnifiedMarket <onboarding@resend.dev>";
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://unified-market.vercel.app";

    let triggered = 0;
    let emailed = 0;
    // Counted separately because a silent zero was exactly how the previous
    // version hid the fact that it was never delivering anything.
    let noRecipient = 0;
    let sendFailed = 0;
    let lastSendError: string | null = null;

    for (const alert of alerts as Alert[]) {
      const quote = quotes.get(alert.symbol);
      if (!quote || !isTriggered(alert, quote)) continue;

      // Mark first. A duplicate email is a nuisance; a repeating alert every
      // fifteen minutes because the send failed is worse.
      const { error: markError } = await supabase
        .from("watchlist_alerts")
        .update({ triggered_at: new Date().toISOString() })
        .eq("id", alert.id)
        .is("triggered_at", null);

      if (markError) {
        console.error(`[check-alerts] could not mark ${alert.id}:`, markError.message);
        continue;
      }
      triggered++;

      if (!resendKey) continue;

      const { data: account, error: lookupError } = await supabase.auth.admin.getUserById(alert.user_id);
      const recipient = account?.user?.email;
      if (!recipient) {
        noRecipient++;
        console.error(
          `[check-alerts] no email for user ${alert.user_id}: ${lookupError?.message ?? "not found"}`,
        );
        continue;
      }

      const headline = describe(alert, quote);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [recipient],
          subject: `${alert.symbol} hit your alert`,
          html: emailHtml(alert.symbol, headline, alert.message, siteUrl),
        }),
      });

      if (response.ok) {
        emailed++;
      } else {
        sendFailed++;
        lastSendError = `${response.status}: ${(await response.text()).slice(0, 200)}`;
        console.error(`[check-alerts] Resend ${lastSendError}`);
      }
    }

    console.log(
      `[check-alerts] triggered ${triggered}, emailed ${emailed}, ` +
        `no recipient ${noRecipient}, send failed ${sendFailed}`,
    );
    return new Response(
      JSON.stringify({
        checked: alerts.length,
        triggered,
        emailed,
        noRecipient,
        sendFailed,
        lastSendError,
        emailConfigured: Boolean(resendKey),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[check-alerts]", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
