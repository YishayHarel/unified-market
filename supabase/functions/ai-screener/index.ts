import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { HOUSE_RULES, MODEL_FAST, parseJsonResponse } from "../_shared/aiContract.ts";
import { checkSubscription, subscriptionRequiredResponse } from "../_shared/subscription.ts";

interface ScreenCriteria {
  marketCapMin?: number;
  marketCapMax?: number;
  dayChangeMinPct?: number;
  dayChangeMaxPct?: number;
  exchanges?: string[];
  nameContains?: string;
  sortBy?: "marketCap" | "dayChange";
  sortDir?: "asc" | "desc";
  limit?: number;
  unsupported?: string[];
}

// CORS configuration - restrict to allowed origins
const ALLOWED_ORIGINS = [
  'https://unified-market.vercel.app',
  'http://localhost:8080',
  'http://localhost:5173'
];

const AI_DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '20');
const AI_ENABLED = (Deno.env.get('AI_ENABLED') ?? 'false') === 'true';

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

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!AI_ENABLED) {
    return new Response(
      JSON.stringify({ error: 'AI is coming soon' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Paid feature: verified before any token is spent.
    const subscription = await checkSubscription(userData.user.email);
    if (!subscription.subscribed) {
      return subscriptionRequiredResponse(subscription, corsHeaders);
    }

    const { data: usageAllowed, error: usageError } = await supabase.rpc('check_ai_usage', {
      p_user_id: userData.user.id,
      p_daily_limit: AI_DAILY_LIMIT
    });
    if (usageError) {
      console.error('[AI Screener] Usage check error:', usageError);
      return new Response(
        JSON.stringify({ error: 'Usage check failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!usageAllowed) {
      return new Response(
        JSON.stringify({ error: 'Daily AI limit reached. Please try again tomorrow.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { query } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AI Screener] Processing query: "${query}"`);

    // A screener is a filter, not a text-generation problem. The model's job
    // here is only to turn a sentence into machine-checkable criteria; the
    // filtering itself runs in SQL, where numeric comparisons are exact.
    // Previously 100 rows were pasted into the prompt and the model was asked
    // to pick matches, which it cannot do reliably — and it was asked to filter
    // on avg_volume and rel_volume, which are NULL for every row in the table.
    const criteriaPrompt = [
      "Convert a stock screening request into JSON criteria. Output JSON only.",
      `Fields you may set (omit any the user did not ask for):
{
  "marketCapMin": number,      // dollars
  "marketCapMax": number,
  "dayChangeMinPct": number,
  "dayChangeMaxPct": number,
  "exchanges": ["NASDAQ"],
  "nameContains": "string",
  "sortBy": "marketCap" | "dayChange",
  "sortDir": "asc" | "desc",
  "limit": number,
  "unsupported": ["criteria you could not express in the fields above"]
}`,
      "Put anything you cannot express — sectors, PE ratios, volume, sentiment — into `unsupported` rather than approximating it with another field.",
    ].join("\n\n");

    const criteriaResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_FAST,
        messages: [
          { role: 'system', content: criteriaPrompt },
          { role: 'user', content: query },
        ],
        max_tokens: 300,
        // Deterministic: the same request should screen the same way twice.
        temperature: 0,
      }),
    });

    if (!criteriaResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const criteria = parseJsonResponse<ScreenCriteria>(
      (await criteriaResponse.json())?.choices?.[0]?.message?.content ?? '',
    );

    if (!criteria) {
      return new Response(
        JSON.stringify({ error: 'Could not interpret that request' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only rows carrying a ranking snapshot have usable fundamentals; the rest
    // of the table is symbols with no metrics attached.
    let dbQuery = supabase
      .from('stocks')
      .select('symbol, name, exchange, market_cap, last_return_1d, last_ranked_at')
      .not('market_cap', 'is', null);

    if (typeof criteria.marketCapMin === 'number') dbQuery = dbQuery.gte('market_cap', criteria.marketCapMin);
    if (typeof criteria.marketCapMax === 'number') dbQuery = dbQuery.lte('market_cap', criteria.marketCapMax);
    if (typeof criteria.dayChangeMinPct === 'number') dbQuery = dbQuery.gte('last_return_1d', criteria.dayChangeMinPct);
    if (typeof criteria.dayChangeMaxPct === 'number') dbQuery = dbQuery.lte('last_return_1d', criteria.dayChangeMaxPct);
    if (Array.isArray(criteria.exchanges) && criteria.exchanges.length > 0) dbQuery = dbQuery.in('exchange', criteria.exchanges);
    if (criteria.nameContains) dbQuery = dbQuery.ilike('name', `%${criteria.nameContains}%`);

    const sortColumn = criteria.sortBy === 'dayChange' ? 'last_return_1d' : 'market_cap';
    dbQuery = dbQuery
      .order(sortColumn, { ascending: criteria.sortDir === 'asc', nullsFirst: false })
      .limit(Math.min(Math.max(1, Number(criteria.limit) || 20), 50));

    const { data: matches, error: matchError } = await dbQuery;
    if (matchError) {
      console.error('[AI Screener] Screen failed:', matchError.message);
      return new Response(
        JSON.stringify({ error: 'Screen failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rows = matches ?? [];

    // Say how old the numbers are rather than presenting a stale screen as
    // current. update-top-100 is what refreshes these.
    const staleness = rows[0]?.last_ranked_at
      ? `Fundamentals last refreshed ${String(rows[0].last_ranked_at).slice(0, 10)}.`
      : 'Refresh date unknown.';

    const caveats = [
      ...(criteria.unsupported ?? []).map(
        (c: string) => `Could not screen on "${c}" — that data is not held.`,
      ),
      staleness,
    ];

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          interpretation: criteria,
          matches: [],
          summary: 'No stocks in the dataset matched those criteria.',
          caveats,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = [
      "You are a stock screener explaining a result set that has already been computed.",
      HOUSE_RULES,
      `TASK:
The MATCHES below were selected in SQL and are final — do not add, drop, or
reorder them. Write one short sentence per match saying why it fits the request,
using only the figures given. Then one sentence summarising the set.`,
      `RESPONSE FORMAT:
JSON only:
{ "summary": "one sentence", "notes": { "SYMBOL": "one sentence" } }`,
    ].join("\n\n");

    const userPrompt = `Request: "${query}"

Criteria applied: ${JSON.stringify(criteria)}

MATCHES:
${rows.map((r) => `- ${r.symbol} (${r.name}), exchange ${r.exchange}, market cap ${r.market_cap}, last daily return ${r.last_return_1d}%`).join('\n')}

${caveats.join(' ')}`;

    console.log('[AI Screener] Calling OpenAI API...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_FAST,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Screener] OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[AI Screener] No content in response');
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response
    let result;
    try {
      // Clean the content - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      result = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error('[AI Screener] Failed to parse AI response:', content);
      result = {
        interpretation: "Processed your query",
        matches: [],
        summary: content
      };
    }

    console.log(`[AI Screener] Found ${result.matches?.length || 0} matching stocks`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI Screener] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
