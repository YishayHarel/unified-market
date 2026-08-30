// Earnings calendar via Finnhub; CORS + multi-key match other edge functions.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { nextFinnhubKey } from "../_shared/api-keys.ts";
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIdentifier,
  RATE_LIMIT_TIERS,
} from "../_shared/rate-limit.ts";

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const clientId = getClientIdentifier(req);
  const rateCheck = checkRateLimit(`earnings:${clientId}`, RATE_LIMIT_TIERS.data);
  if (!rateCheck.allowed) {
    return createRateLimitResponse(rateCheck, corsHeaders);
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

    // Finnhub caps this endpoint at roughly 1500 rows, and when a range exceeds
    // that it truncates from the START — so a 60-day request came back
    // beginning six weeks out, hiding precisely the earnings a reader wants.
    // Requesting in shorter slices keeps every window under the cap.
    const CHUNK_DAYS = 14;
    const DAY_MS = 24 * 60 * 60 * 1000;

    async function fetchWindow(windowFrom: string, windowTo: string) {
      const params = new URLSearchParams({ token: apiKey, from: windowFrom, to: windowTo });
      if (symbol) params.append("symbol", symbol);
      // Optional wider calendar; default US-only — some Finnhub plans behave badly with international=true
      if (body.international === true) params.append("international", "true");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`https://finnhub.io/api/v1/calendar/earnings?${params}`, {
          signal: controller.signal,
          headers: { "User-Agent": "UnifiedMarket/1.0" },
        });
        if (!response.ok) {
          const text = await response.text();
          console.error(`Finnhub earnings ${response.status} for ${windowFrom}..${windowTo}:`, text.slice(0, 200));
          return [];
        }
        const data = await response.json();
        return Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];
      } catch (err) {
        console.error(`Finnhub earnings failed for ${windowFrom}..${windowTo}:`, err);
        return [];
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const windows: Array<[string, string]> = [];
    for (let cursor = new Date(from); cursor <= new Date(to); ) {
      const end = new Date(Math.min(cursor.getTime() + (CHUNK_DAYS - 1) * DAY_MS, new Date(to).getTime()));
      windows.push([cursor.toISOString().split("T")[0], end.toISOString().split("T")[0]]);
      cursor = new Date(end.getTime() + DAY_MS);
    }

    const chunks = await Promise.all(windows.map(([f, t]) => fetchWindow(f, t)));

    // Windows are exclusive of each other, but dedupe on symbol+date anyway so a
    // boundary overlap cannot double-list a company.
    const seen = new Set<string>();
    const raw = chunks.flat().filter((e: Record<string, unknown>) => {
      const key = `${e.symbol}|${e.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`Earnings ${from}..${to}: ${windows.length} windows, ${raw.length} rows`);

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
