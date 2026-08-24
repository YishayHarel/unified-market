import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { HOUSE_RULES, ANALYSIS_CHECKLIST, DISCLAIMER, MODEL_FAST } from "../_shared/aiContract.ts";
import { loadPortfolioContext, formatPortfolioContext } from "../_shared/portfolioContext.ts";
import { checkSubscription, subscriptionRequiredResponse } from "../_shared/subscription.ts";

// Rate limiting storage
interface RateLimit {
  count: number;
  resetTime: number;
}

const rateLimits = new Map<string, RateLimit>();
const AI_DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '20');
const AI_ENABLED = (Deno.env.get('AI_ENABLED') ?? 'false') === 'true';

// Checks rate limit for identifier
function checkRateLimit(
  identifier: string,
  maxRequests: number = 20,
  windowMs: number = 60 * 1000
): { allowed: boolean; resetTime: number; remaining: number } {
  const now = Date.now();
  const limit = rateLimits.get(identifier);

  if (!limit || now > limit.resetTime) {
    rateLimits.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, resetTime: now + windowMs, remaining: maxRequests - 1 };
  }

  if (limit.count >= maxRequests) {
    return { allowed: false, resetTime: limit.resetTime, remaining: 0 };
  }

  limit.count++;
  rateLimits.set(identifier, limit);
  return { allowed: true, resetTime: limit.resetTime, remaining: maxRequests - limit.count };
}

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://unified-market.vercel.app',
  'http://localhost:8080',
  'http://localhost:5173'
];

// Returns CORS headers based on origin
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
    // Auth check
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

    // Get authenticated user
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;

    // Paid feature: verified before any token is spent.
    const subscription = await checkSubscription(userData.user.email);
    if (!subscription.subscribed) {
      return subscriptionRequiredResponse(subscription, corsHeaders);
    }

    // Rate limiting
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: usageAllowed, error: usageError } = await supabase.rpc('check_ai_usage', {
      p_user_id: userId,
      p_daily_limit: AI_DAILY_LIMIT
    });
    if (usageError) {
      console.error('[AI Stock Advisor] Usage check error:', usageError);
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

    const { message, conversationHistory = [] } = await req.json();
    
    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AI Stock Advisor] Processing message for user: ${userId.substring(0, 8)}...`);

    // Portfolio, live prices, and headlines about the reader's own symbols.
    // Previously this endpoint fetched holdings and then dropped cost basis and
    // current price before prompting, so it could not discuss anyone's P&L.
    const context = await loadPortfolioContext(supabase, userId);

    // Use OpenAI API
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      console.error('[AI Stock Advisor] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Conversational endpoint, so prose rather than the JSON contract — but the
    // same house rules and checklist as every other AI feature.
    const systemPrompt = [
      "You are YishAI, a stock market analyst for UnifiedMarket, talking with a reader about their own portfolio.",
      HOUSE_RULES,
      ANALYSIS_CHECKLIST,
      "STYLE:\nConversational and direct. Lead with the specific figure that answers the question. Keep it under 250 words unless asked for more. Name stock symbols in capitals.",
      `DATA (the only figures you may cite):\n${formatPortfolioContext(context)}`,
      `Today is ${new Date().toISOString().slice(0, 10)}.`,
      `Close with this exact line when you have given any analysis: "${DISCLAIMER}"`,
    ].join("\n\n");

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: 'user', content: message }
    ];

    console.log('[AI Stock Advisor] Calling OpenAI API...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_FAST,
        messages,
        max_tokens: 1000,
        // Low, not zero: this is analysis over supplied figures, and higher
        // temperatures make a model likelier to embellish beyond the data.
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Stock Advisor] OpenAI API error:', response.status, errorText);
      
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
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AI Stock Advisor] Response generated successfully');

    return new Response(
      JSON.stringify({ 
        response: content,
        usage: data.usage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI Stock Advisor] Error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
