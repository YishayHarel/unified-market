// Earnings calendar via Finnhub; CORS + multi-key match other edge functions.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { nextFinnhubKey } from "../_shared/api-keys.ts";

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let body: { from?: string; to?: string; symbol?: string; international?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const apiKey = nextFinnhubKey();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "FINNHUB_API_KEY not configured", earningsCalendar: [] }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    const defaultFrom = today.toISOString().split("T")[0];
    const defaultTo = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let from = body.from?.trim() || defaultFrom;
    let to = body.to?.trim() || defaultTo;
    const symbol = body.symbol?.trim().toUpperCase() || "";

    if (from > to) {
      const t = from;
      from = to;
      to = t;
    }

    const params = new URLSearchParams({ token: apiKey, from, to });
    if (symbol) params.append("symbol", symbol);
    // Optional wider calendar; default US-only — some Finnhub plans behave badly with international=true
    if (body.international === true) params.append("international", "true");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`https://finnhub.io/api/v1/calendar/earnings?${params}`, {
      signal: controller.signal,
      headers: { "User-Agent": "UnifiedMarket/1.0" },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      console.error(`Finnhub earnings ${response.status}:`, text.slice(0, 200));
      return new Response(
        JSON.stringify({
          error: `Finnhub error ${response.status}`,
          earningsCalendar: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const raw = Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];

    if (raw.length === 0) {
      return new Response(JSON.stringify({ earningsCalendar: [], totalCount: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      const normalized = raw.map((e: Record<string, unknown>) => ({
        symbol: e.symbol,
        date: e.date,
        epsEstimate: e.epsEstimate ?? e.eps_estimate,
        epsActual: e.epsActual ?? e.eps_actual,
        hour: e.hour ?? "",
        quarter: e.quarter,
        year: e.year,
        company_name: e.symbol,
        market_cap: 0,
      }));
      return new Response(JSON.stringify({ earningsCalendar: normalized, totalCount: normalized.length }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const symbols = [...new Set(raw.map((e: { symbol: string }) => e.symbol).filter(Boolean))];

    const { data: stocks } = await supabase.from("stocks").select("symbol, name, market_cap").in("symbol", symbols);

    const stockMap = new Map<string, { name?: string; market_cap?: number }>();
    stocks?.forEach((s: { symbol: string; name?: string; market_cap?: number }) => stockMap.set(s.symbol, s));

    const enriched = raw.map((earning: Record<string, unknown>) => {
      const sym = String(earning.symbol || "");
      const info = stockMap.get(sym);
      return {
        symbol: sym,
        date: earning.date,
        epsEstimate: earning.epsEstimate ?? earning.eps_estimate,
        epsActual: earning.epsActual ?? earning.eps_actual,
        hour: earning.hour ?? "",
        quarter: earning.quarter,
        year: earning.year,
        market_cap: info?.market_cap ?? 0,
        company_name: info?.name || sym,
      };
    });

    enriched.sort((a: { date: string; market_cap?: number }, b: { date: string; market_cap?: number }) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return (b.market_cap || 0) - (a.market_cap || 0);
    });

    return new Response(JSON.stringify({ earningsCalendar: enriched, totalCount: enriched.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    console.error("get-earnings:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to fetch earnings", earningsCalendar: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
