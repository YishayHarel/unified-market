import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { HOUSE_RULES, MODEL_DEEP, parseJsonResponse, missingFields } from "../_shared/aiContract.ts";
import { gapStatsForSymbol, describeGapStats } from "../_shared/marketStats.ts";
import { checkSubscription, subscriptionRequiredResponse } from "../_shared/subscription.ts";

// CORS configuration - restrict to allowed origins.
// The production origin was missing, so this endpoint only ever worked from a
// developer's machine.
const ALLOWED_ORIGINS = [
  'https://unified-market.vercel.app',
  'http://localhost:8080',
  'http://localhost:5173'
];

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

const AI_ENABLED = (Deno.env.get('AI_ENABLED') ?? 'false') === 'true';

// Yahoo Finance futures symbols
const FUTURES_SYMBOLS = {
  'ES=F': 'S&P 500 Futures',
  'NQ=F': 'Nasdaq 100 Futures', 
  'YM=F': 'Dow Jones Futures',
};

interface FuturesData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface MarketData {
  futures: FuturesData[];
  vix: { value: number; change: number } | null;
  treasury2Y: { value: number; change: number } | null;
  treasury10Y: { value: number; change: number } | null;
  yieldSpread: number | null;
}

// Fetch futures data from Yahoo Finance
async function fetchYahooFutures(): Promise<FuturesData[]> {
  const futures: FuturesData[] = [];
  
  for (const [symbol, name] of Object.entries(FUTURES_SYMBOLS)) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      if (!response.ok) {
        console.log(`[Morning Brief] Yahoo Finance error for ${symbol}: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const result = data?.chart?.result?.[0];
      
      if (result?.meta?.regularMarketPrice) {
        const currentPrice = result.meta.regularMarketPrice;
        const previousClose = result.meta.previousClose || currentPrice;
        const change = currentPrice - previousClose;
        const changePercent = (change / previousClose) * 100;
        
        futures.push({
          symbol: symbol.replace('=F', ''),
          name,
          price: currentPrice,
          change,
          changePercent
        });
      }
    } catch (error) {
      console.error(`[Morning Brief] Error fetching ${symbol}:`, error);
    }
  }
  
  return futures;
}

// Fetch VIX data from Yahoo Finance
async function fetchVIX(): Promise<{ value: number; change: number } | null> {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=2d';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    
    if (result?.meta?.regularMarketPrice) {
      const currentPrice = result.meta.regularMarketPrice;
      const previousClose = result.meta.previousClose || currentPrice;
      return {
        value: currentPrice,
        change: currentPrice - previousClose
      };
    }
  } catch (error) {
    console.error('[Morning Brief] Error fetching VIX:', error);
  }
  return null;
}

// Fetch Treasury yields from Alpha Vantage
async function fetchTreasuryYield(maturity: string, apiKey: string): Promise<{ value: number; change: number } | null> {
  try {
    const url = `https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=${maturity}&apikey=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data['Error Message'] || data['Note']) {
      console.log(`[Morning Brief] Alpha Vantage Treasury error:`, data['Error Message'] || data['Note']);
      return null;
    }
    
    const timeSeries = data['data'];
    if (!timeSeries || timeSeries.length < 2) return null;
    
    const current = parseFloat(timeSeries[0].value);
    const previous = parseFloat(timeSeries[1].value);
    
    return {
      value: current,
      change: current - previous
    };
  } catch (error) {
    console.error(`[Morning Brief] Error fetching Treasury ${maturity}:`, error);
  }
  return null;
}

// Get sentiment tier based on market conditions
/** Per-holding history costs a Yahoo round trip each; keep the brief quick. */
const MAX_HOLDINGS_ANALYSED = 6;

/**
 * How far a symbol is indicated from yesterday's close right now.
 *
 * Reads the pre/post series, so before the bell the last point is the
 * pre-market print and this is the indicated opening gap. The figure is only
 * meaningful pre-open — run intraday it measures the session move instead,
 * which is why this brief is scheduled before the open.
 */
async function indicatedGapPct(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?includePrePost=true&interval=1m&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UnifiedMarket/1.0)' } },
    );
    if (!res.ok) return null;

    const result = (await res.json())?.chart?.result?.[0];
    const previousClose = result?.meta?.previousClose;
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
    if (!previousClose) return null;

    // Thin pre-market tape leaves gaps in the series; walk back to the last print.
    for (let i = closes.length - 1; i >= 0; i--) {
      const price = closes[i];
      if (price != null && price > 0) return (price / previousClose - 1) * 100;
    }

    const last = result?.meta?.regularMarketPrice;
    return last ? (last / previousClose - 1) * 100 : null;
  } catch {
    return null;
  }
}

/**
 * Classifies the pre-open tape from futures and volatility.
 *
 * This replaces a version that produced a "confidence" percentage from
 * `50 + Math.random() * 10` for a flat tape and from invented arithmetic
 * elsewhere, then attached hardcoded advice ("Consider buying on dips").
 * A number shown to someone deciding what to do with their money has to mean
 * something, so the tier here is a plain description of the tape and the only
 * percentage in the brief now comes from counted history.
 */
function classifyTape(
  futures: FuturesData[],
  vix: { value: number; change: number } | null,
): { tier: string; avgFuturesChangePct: number; volatilityNote: string } {
  const avgFuturesChangePct = futures.length > 0
    ? futures.reduce((sum, f) => sum + f.changePercent, 0) / futures.length
    : 0;

  // Descriptive bands only — these say what the tape is doing, not what it
  // will do next.
  const tier =
    avgFuturesChangePct > 1.5 ? 'Sharply higher'
    : avgFuturesChangePct > 0.7 ? 'Higher'
    : avgFuturesChangePct > 0.2 ? 'Modestly higher'
    : avgFuturesChangePct >= -0.2 ? 'Flat'
    : avgFuturesChangePct > -0.7 ? 'Modestly lower'
    : avgFuturesChangePct > -1.5 ? 'Lower'
    : 'Sharply lower';

  const level = vix?.value ?? null;
  const change = vix?.change ?? 0;
  const volatilityNote =
    level == null ? 'VIX unavailable.'
    : level > 30 ? `VIX ${level.toFixed(1)} (${change >= 0 ? '+' : ''}${change.toFixed(1)}) — elevated; wider ranges than usual.`
    : level > 20 ? `VIX ${level.toFixed(1)} (${change >= 0 ? '+' : ''}${change.toFixed(1)}) — above average.`
    : `VIX ${level.toFixed(1)} (${change >= 0 ? '+' : ''}${change.toFixed(1)}) — subdued.`;

  return { tier, avgFuturesChangePct, volatilityNote };
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const alphaVantageKey = Deno.env.get('ALPHA_VANTAGE_API_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // The user is taken from the verified token, never from the request body.
    // This previously read `userId` straight out of the JSON payload with no
    // auth at all, so any caller could name any user's id and receive that
    // person's holdings, cost basis and watchlist.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;

    // Paid feature: checked before any token is spent.
    const subscription = await checkSubscription(userData.user.email);
    if (!subscription.subscribed) {
      return subscriptionRequiredResponse(subscription, corsHeaders);
    }

    console.log(`[Morning Brief] Generating brief for user: ${userId.slice(0, 8)}…`);

    // Fetch all data in parallel
    const [
      futuresData,
      vixData,
      treasury2Y,
      treasury10Y,
      savedStocksResult,
      holdingsResult,
      topMoversResult,
      bottomMoversResult
    ] = await Promise.all([
      fetchYahooFutures(),
      fetchVIX(),
      fetchTreasuryYield('2year', alphaVantageKey),
      fetchTreasuryYield('10year', alphaVantageKey),
      supabase.from('user_saved_stocks').select('symbol, name').eq('user_id', userId),
      supabase.from('portfolio_holdings').select('symbol, company_name, shares, avg_cost, current_price, sector').eq('user_id', userId),
      supabase.from('stocks').select('symbol, name, last_return_1d, rel_volume').order('last_return_1d', { ascending: false }).limit(5),
      supabase.from('stocks').select('symbol, name, last_return_1d, rel_volume').order('last_return_1d', { ascending: true }).limit(5)
    ]);

    const savedStocks = savedStocksResult.data || [];
    const holdings = holdingsResult.data || [];
    const topMovers = topMoversResult.data || [];
    const bottomMovers = bottomMoversResult.data || [];

    // Calculate yield spread
    const yieldSpread = treasury10Y && treasury2Y 
      ? treasury10Y.value - treasury2Y.value 
      : null;

    // Get market sentiment
    const tape = classifyTape(futuresData, vixData);

    // Historical base rates for a tape like this one, and for each holding's
    // indicated gap. Every percentage the reader sees originates here, not from
    // the model. SPY stands in for the index because its bars carry the actual
    // realised open, which is what a futures level is a forecast of.
    const [indexStats, holdingStats] = await Promise.all([
      gapStatsForSymbol('SPY', tape.avgFuturesChangePct, '5y'),
      Promise.all(
        holdings.slice(0, MAX_HOLDINGS_ANALYSED).map(async (holding: { symbol: string }) => {
          const gapPct = await indicatedGapPct(holding.symbol);
          if (gapPct == null) return { symbol: holding.symbol, line: null };
          const stats = await gapStatsForSymbol(holding.symbol, gapPct, '5y');
          return { symbol: holding.symbol, line: describeGapStats(holding.symbol, gapPct, stats) };
        }),
      ),
    ]);

    const baseRateLines = [
      describeGapStats('S&P 500 (via SPY)', tape.avgFuturesChangePct, indexStats),
      ...holdingStats.map((h) => h.line).filter(Boolean),
    ].join('\n');

    // Calculate portfolio stats
    let portfolioStats = null;
    if (holdings.length > 0) {
      const totalValue = holdings.reduce((sum, h) => sum + h.shares * (h.current_price || h.avg_cost), 0);
      const totalCost = holdings.reduce((sum, h) => sum + h.shares * h.avg_cost, 0);
      portfolioStats = {
        totalValue,
        totalCost,
        gainLoss: totalValue - totalCost,
        gainLossPercent: ((totalValue - totalCost) / totalCost * 100).toFixed(2),
        holdingsCount: holdings.length
      };
    }

    // Only the holdings the brief actually covers, so the model is not tempted
    // to comment on positions it has no base rate for.
    const portfolioSummary = holdings.length === 0
      ? 'No holdings.'
      : [
          `${holdings.length} positions, total value $${(portfolioStats?.totalValue ?? 0).toFixed(2)}, ` +
            `unrealised ${portfolioStats?.gainLossPercent ?? '0'}%.`,
          ...holdings.slice(0, MAX_HOLDINGS_ANALYSED).map((h) =>
            `- ${h.symbol}: ${h.shares} shares, avg cost $${Number(h.avg_cost).toFixed(2)}` +
              `${h.sector ? `, ${h.sector}` : ''}`
          ),
          holdings.length > MAX_HOLDINGS_ANALYSED
            ? `(${holdings.length - MAX_HOLDINGS_ANALYSED} further positions not covered this morning.)`
            : '',
        ].filter(Boolean).join('\n');

    // Prepare market data summary
    const marketData: MarketData = {
      futures: futuresData,
      vix: vixData,
      treasury2Y,
      treasury10Y,
      yieldSpread
    };

    // Use OpenAI API
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      console.error('[Morning Brief] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const systemPrompt = [
      "You are YishAI writing the Morning Market Brief, published before the US open.",
      HOUSE_RULES,
      `TASK:
Write a brief a reader can absorb in under thirty seconds. Be specific and
plain. No filler, no hedged throat-clearing, no restating the data back.

The BASE RATES section contains percentages counted from historical daily bars.
They are the only percentages that exist. Quote them as given. You may set an
"adjusted" number when a concrete factor in the data justifies moving off the
base rate — but you must name that factor, and you must keep the base rate
visible alongside it. If nothing justifies an adjustment, repeat the base rate
and say the tape offers no reason to deviate.

Never recommend buying, selling, or holding.`,
      `RESPONSE FORMAT:
JSON only, no markdown fence, matching exactly:
{
  "headline": "one sentence, under 15 words, what matters this morning",
  "tape": "one or two sentences on futures, volatility and yields together",
  "openOdds": {
    "baseRatePct": 0,
    "adjustedPct": 0,
    "basis": "one sentence naming the sample behind the base rate",
    "adjustment": "one sentence naming what moved it, or why nothing did"
  },
  "holdings": [
    { "symbol": "TICK", "note": "one sentence: indicated move plus its base rate" }
  ],
  "watch": ["at most three short items"],
  "risk": "one sentence on the main thing that could go wrong"
}`,
    ].join("\n\n");

    const userPrompt = `Morning Market Brief for ${today}.

TAPE:
Futures: ${futuresData.map((f) => `${f.name} ${f.changePercent >= 0 ? '+' : ''}${f.changePercent.toFixed(2)}%`).join(', ') || 'unavailable'}
Direction: ${tape.tier} (average futures move ${tape.avgFuturesChangePct >= 0 ? '+' : ''}${tape.avgFuturesChangePct.toFixed(2)}%)
Volatility: ${tape.volatilityNote}
Treasuries: 2Y ${treasury2Y ? `${treasury2Y.value.toFixed(2)}% (${treasury2Y.change >= 0 ? '+' : ''}${treasury2Y.change.toFixed(3)})` : 'n/a'}, 10Y ${treasury10Y ? `${treasury10Y.value.toFixed(2)}% (${treasury10Y.change >= 0 ? '+' : ''}${treasury10Y.change.toFixed(3)})` : 'n/a'}, 10Y-2Y spread ${yieldSpread !== null ? `${yieldSpread.toFixed(2)}%` : 'n/a'}

BASE RATES (counted from historical daily bars — the only percentages available):
${baseRateLines}

READER'S PORTFOLIO:
${portfolioSummary}

Write the brief.`;

    console.log('[Morning Brief] Calling OpenAI API...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_DEEP,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 900,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Morning Brief] OpenAI API error:', response.status, errorText);
      
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

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[Morning Brief] No content in AI response');
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse AI response
    let result;
    try {
      result = parseJsonResponse<Record<string, unknown>>(content);
      const missing = missingFields(result, ['headline', 'tape', 'openOdds']);
      if (missing.length > 0) {
        throw new Error(`Model response missing: ${missing.join(', ')}`);
      }
    } catch (parseError) {
      console.error('[Morning Brief] Invalid model response:', parseError);
      // Degrade to the computed layer rather than showing unvalidated model
      // prose. The statistics were counted from real bars, so they stand on
      // their own without the narration.
      result = {
        headline: `${tape.tier} into the open.`,
        tape: `${tape.tier}. ${tape.volatilityNote}`,
        openOdds: null,
        baseRatesOnly: true,
        note: 'Narration unavailable this morning; figures below are computed from historical bars.',
      };
    }

    // Add metadata and raw market data
    result.generatedAt = new Date().toISOString();
    result.marketData = marketData;
    result.portfolioStats = portfolioStats;
    result.tape = tape;
    result.baseRates = baseRateLines;

    console.log('[Morning Brief] Brief generated successfully');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Morning Brief] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
