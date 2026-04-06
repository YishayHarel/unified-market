// Treasury yields + VIX: FRED first (high limits), Alpha Vantage fallback.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { nextAlphaVantageKey, getAlphaVantageKeys } from "../_shared/api-keys.ts";

const CACHE_TTL_MS = 30 * 60 * 1000;
const dataCache = new Map<string, { data: unknown; expiry: number }>();

/** Last successful batch (survives TTL) for stale-while-revalidate when APIs rate-limit */
let lastGoodBatch: {
  vix: SeriesPayload | null;
  treasury2y: SeriesPayload | null;
  treasury10y: SeriesPayload | null;
} | null = null;

type SeriesPayload = {
  data: Array<{ date: string; value: number }>;
  current: number;
  change: number;
  source?: string;
};

function getCached(key: string): unknown | null {
  const cached = dataCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    console.log(`Cache hit for ${key}`);
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  dataCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

const FRED_MATURITY: Record<string, string> = {
  "3month": "DGS3MO",
  "2year": "DGS2",
  "5year": "DGS5",
  "7year": "DGS7",
  "10year": "DGS10",
  "30year": "DGS30",
};

async function fetchFredSeries(seriesId: string, apiKey: string): Promise<SeriesPayload | null> {
  try {
    const url =
      `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(seriesId)}` +
      `&api_key=${encodeURIComponent(apiKey)}&file_type=json&sort_order=desc&limit=65`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "UnifiedMarket/1.0" },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`FRED ${seriesId} HTTP ${response.status}`);
      return null;
    }

    const json = await response.json();
    const observations = json?.observations;
    if (!Array.isArray(observations) || observations.length === 0) {
      return null;
    }

    const valid = observations
      .filter((d: { value?: string }) => d.value !== "." && d.value != null)
      .map((d: { date: string; value: string }) => ({
        date: d.date,
        value: parseFloat(d.value),
      }))
      .filter((d: { value: number }) => !Number.isNaN(d.value));

    if (valid.length < 2) return null;

    const current = valid[0].value;
    const previous = valid[1].value;
    const change = current - previous;
    const data = valid.slice(0, 60).reverse();

    return { data, current, change, source: "fred" };
  } catch (e) {
    console.error(`FRED ${seriesId}:`, e);
    return null;
  }
}

async function fetchTreasuryYield(
  maturity: string,
  apiKey: string,
): Promise<SeriesPayload | null> {
  try {
    const url =
      `https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=${maturity}&apikey=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "UnifiedMarket/1.0" },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const json = await response.json();
    if (json["Note"] || json["Error Message"] || json["Information"]) {
      console.error("Alpha Vantage Treasury:", json["Note"] || json["Information"]);
      return null;
    }

    const dataPoints = json["data"];
    if (!Array.isArray(dataPoints) || dataPoints.length === 0) return null;

    const validData = dataPoints
      .filter((d: { value: string }) => d.value !== "." && d.value !== null)
      .map((d: { date: string; value: string }) => ({
        date: d.date,
        value: parseFloat(d.value),
      }))
      .filter((d: { value: number }) => !Number.isNaN(d.value));

    if (validData.length < 2) return null;

    const current = validData[0].value;
    const previous = validData[1].value;
    const change = current - previous;

    return {
      data: validData.slice(0, 60).reverse(),
      current,
      change,
      source: "alpha_vantage",
    };
  } catch (e) {
    console.error(`Alpha Treasury ${maturity}:`, e);
    return null;
  }
}

async function fetchVixData(apiKey: string): Promise<SeriesPayload | null> {
  try {
    const url =
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=VIX&outputsize=compact&apikey=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "UnifiedMarket/1.0" },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const json = await response.json();
    if (json["Note"] || json["Error Message"] || json["Information"]) {
      console.error("Alpha VIX:", json["Note"] || json["Information"]);
      return null;
    }

    const timeSeries = json["Time Series (Daily)"];
    if (!timeSeries) return null;

    const entries = Object.entries(timeSeries)
      .map(([date, values]) => ({
        date,
        value: parseFloat((values as Record<string, string>)["4. close"]),
      }))
      .filter((d) => !Number.isNaN(d.value))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (entries.length < 2) return null;

    const current = entries[0].value;
    const previous = entries[1].value;
    const change = current - previous;

    return {
      data: entries.slice(0, 60).reverse(),
      current,
      change,
      source: "alpha_vantage",
    };
  } catch (e) {
    console.error("Alpha VIX:", e);
    return null;
  }
}

async function fetchBatchFromFred(fredKey: string) {
  const [vix, treasury2y, treasury10y] = await Promise.all([
    fetchFredSeries("VIXCLS", fredKey),
    fetchFredSeries("DGS2", fredKey),
    fetchFredSeries("DGS10", fredKey),
  ]);
  return { vix, treasury2y, treasury10y };
}

async function fetchBatchFromAlpha() {
  const keys = getAlphaVantageKeys();
  const delayMs = keys.length >= 3 ? 800 : 15000;
  const k1 = nextAlphaVantageKey();
  const k2 = nextAlphaVantageKey();
  const k3 = nextAlphaVantageKey();
  let vix = k1 ? await fetchVixData(k1) : null;
  await new Promise((r) => setTimeout(r, delayMs));
  let treasury2y = k2 ? await fetchTreasuryYield("2year", k2) : null;
  await new Promise((r) => setTimeout(r, delayMs));
  let treasury10y = k3 ? await fetchTreasuryYield("10year", k3) : null;
  return { vix, treasury2y, treasury10y };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const fredKey = (Deno.env.get("FRED_API_KEY") ?? "").trim();

  try {
    const body = await req.json().catch(() => ({}));
    const { type, maturity } = body as { type?: string; maturity?: string };

    const jsonHeaders = {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    };

    if (type === "batch") {
      const cacheKeyBatch = "batch-vix-2y-10y";
      const cached = getCached(cacheKeyBatch);
      if (cached) {
        return new Response(JSON.stringify(cached), { headers: jsonHeaders });
      }

      let batch: {
        vix: SeriesPayload | null;
        treasury2y: SeriesPayload | null;
        treasury10y: SeriesPayload | null;
        stale?: boolean;
      };

      if (fredKey) {
        console.log("Treasury/VIX batch: trying FRED (3 parallel series)");
        batch = await fetchBatchFromFred(fredKey);
      } else {
        batch = { vix: null, treasury2y: null, treasury10y: null };
      }

      const fredEmpty = !batch.vix && !batch.treasury2y && !batch.treasury10y;
      if (fredEmpty && getAlphaVantageKeys().length > 0) {
        console.log("Treasury/VIX batch: FRED empty or unset, falling back to Alpha Vantage");
        batch = await fetchBatchFromAlpha();
      }

      if (batch.vix || batch.treasury2y || batch.treasury10y) {
        lastGoodBatch = {
          vix: batch.vix,
          treasury2y: batch.treasury2y,
          treasury10y: batch.treasury10y,
        };
        setCache(cacheKeyBatch, batch);
        return new Response(JSON.stringify(batch), { headers: jsonHeaders });
      }

      if (
        lastGoodBatch &&
        (lastGoodBatch.vix || lastGoodBatch.treasury2y || lastGoodBatch.treasury10y)
      ) {
        console.warn("Serving stale treasury/VIX batch (APIs rate-limited or down)");
        return new Response(
          JSON.stringify({ ...lastGoodBatch, stale: true }),
          {
            headers: {
              ...jsonHeaders,
              "X-Served-Stale": "true",
            },
          },
        );
      }

      return new Response(
        JSON.stringify({
          error:
            "Unable to fetch data. Set FRED_API_KEY (recommended) or ALPHA_VANTAGE_API_KEY in Supabase secrets.",
          vix: null,
          treasury2y: null,
          treasury10y: null,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!fredKey && getAlphaVantageKeys().length === 0) {
      throw new Error(
        "Configure FRED_API_KEY and/or ALPHA_VANTAGE_API_KEY (or ALPHA_VANTAGE_API_KEYS) in Supabase",
      );
    }

    if (type === "vix") {
      const cacheKey = "vix";
      let result = getCached(cacheKey) as SeriesPayload | null;
      if (!result) {
        if (fredKey) {
          result = await fetchFredSeries("VIXCLS", fredKey);
        }
        if (!result) {
          const k = nextAlphaVantageKey();
          if (k) result = await fetchVixData(k);
        }
        if (result) setCache(cacheKey, result);
      }
      if (!result) {
        return new Response(
          JSON.stringify({ error: "Unable to fetch VIX", data: null }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify(result), { headers: jsonHeaders });
    }

    if (type === "treasury") {
      const validMaturities = ["3month", "2year", "5year", "7year", "10year", "30year"];
      if (!validMaturities.includes(maturity ?? "")) {
        throw new Error(`Invalid maturity. Use: ${validMaturities.join(", ")}`);
      }
      const cacheKey = `treasury-${maturity}`;
      let result = getCached(cacheKey) as SeriesPayload | null;
      if (!result) {
        const seriesId = FRED_MATURITY[maturity!];
        if (fredKey && seriesId) {
          result = await fetchFredSeries(seriesId, fredKey);
        }
        if (!result) {
          const k = nextAlphaVantageKey();
          if (k) result = await fetchTreasuryYield(maturity!, k);
        }
        if (result) setCache(cacheKey, result);
      }
      if (!result) {
        return new Response(
          JSON.stringify({ error: "Unable to fetch treasury yield", data: null }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify(result), { headers: jsonHeaders });
    }

    throw new Error('Invalid type. Use "vix", "treasury", or "batch"');
  } catch (error) {
    console.error("Error in get-treasury-vix:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
