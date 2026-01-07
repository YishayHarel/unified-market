import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// CORS configuration - restrict to allowed origins
const ALLOWED_ORIGINS = [
  'https://85a34aed-b2cd-4a8b-8664-ff1b782adf81.lovableproject.com',
  'https://lovable.dev',
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

// Rate limiting
interface RateLimit {
  count: number;
  resetTime: number;
}
const rateLimits = new Map<string, RateLimit>();
const MAX_REQUESTS_PER_MINUTE = 5; // AI daily brief is expensive

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const limit = rateLimits.get(identifier);
  if (!limit || now > limit.resetTime) {
    rateLimits.set(identifier, { count: 1, resetTime: now + 60000 });
    return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - 1 };
  }
  if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
    return { allowed: false, remaining: 0 };
  }
  limit.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - limit.count };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Authenticate user from JWT token instead of trusting request body
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // SECURITY: Get authenticated user ID from token, not from request body
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData.user) {
      console.error('[AI Daily Brief] Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;
    
    // Rate limiting by user ID
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
      );
    }

    console.log(`[AI Daily Brief] Generating brief for authenticated user: ${userId.substring(0, 8)}...`);

    // Fetch user's watchlist - now using verified userId
    const { data: savedStocks } = await supabase
      .from('user_saved_stocks')
      .select('symbol, name')
      .eq('user_id', userId);

    // Fetch user's portfolio
    const { data: holdings } = await supabase
      .from('portfolio_holdings')
      .select('symbol, company_name, shares, avg_cost, current_price, sector')
      .eq('user_id', userId);

    // Fetch top movers
    const { data: topMovers } = await supabase
      .from('stocks')
      .select('symbol, name, last_return_1d, rel_volume')
      .order('last_return_1d', { ascending: false })
      .limit(10);

    // Fetch bottom movers  
    const { data: bottomMovers } = await supabase
      .from('stocks')
      .select('symbol, name, last_return_1d, rel_volume')
      .order('last_return_1d', { ascending: true })
      .limit(10);

    // Fetch unusual volume
    const { data: unusualVolume } = await supabase
      .from('stocks')
      .select('symbol, name, rel_volume, last_return_1d')
      .gt('rel_volume', 2)
      .order('rel_volume', { ascending: false })
      .limit(5);

    // Calculate portfolio stats
    let portfolioStats = null;
    if (holdings && holdings.length > 0) {
      const totalValue = holdings.reduce((sum, h) => sum + h.shares * (h.current_price || h.avg_cost), 0);
      const totalCost = holdings.reduce((sum, h) => sum + h.shares * h.avg_cost, 0);
      const dayChange = holdings.reduce((sum, h) => {
        const change = (h.current_price || h.avg_cost) - h.avg_cost;
        return sum + (h.shares * change);
      }, 0);
      
      portfolioStats = {
        totalValue,
        totalCost,
        dayChange,
        dayChangePercent: ((totalValue - totalCost) / totalCost * 100).toFixed(2),
        holdingsCount: holdings.length
      };
    }

    // Use OpenAI API
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      console.error('[AI Daily Brief] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a financial news anchor AI providing a personalized morning market brief. Be concise, professional, and actionable.

Create a brief that includes:
1. Market Overview - Overall market sentiment
2. Portfolio Highlights - Key changes in user's holdings
3. Watchlist Updates - Notable moves in watched stocks  
4. Top Opportunities - Stocks worth watching today
5. Risk Alerts - Any concerns to be aware of

Format as JSON:
{
  "greeting": "Good morning! Here's your market brief for [date]",
  "marketOverview": {
    "sentiment": "Bullish" | "Bearish" | "Mixed",
    "summary": "Brief market summary",
    "keyDrivers": ["Driver 1", "Driver 2"]
  },
  "portfolioHighlights": [
    { "symbol": "AAPL", "message": "What happened", "sentiment": "positive" | "negative" | "neutral" }
  ],
  "watchlistUpdates": [
    { "symbol": "MSFT", "message": "Update", "action": "watch" | "consider" | "alert" }
  ],
  "topOpportunities": [
    { "symbol": "NVDA", "reason": "Why it's interesting", "type": "momentum" | "value" | "breakout" }
  ],
  "riskAlerts": [
    { "message": "Alert description", "severity": "high" | "medium" | "low" }
  ],
  "actionItems": ["Action 1", "Action 2"],
  "closingThought": "Brief motivational or advisory closing"
}

Always return valid JSON only.`;

    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const userPrompt = `Generate a personalized daily market brief for ${today}.

User's Watchlist (${savedStocks?.length || 0} stocks):
${JSON.stringify(savedStocks || [], null, 2)}

User's Portfolio:
${JSON.stringify(holdings || [], null, 2)}

Portfolio Stats:
${JSON.stringify(portfolioStats, null, 2)}

Today's Top Gainers:
${JSON.stringify(topMovers || [], null, 2)}

Today's Top Losers:
${JSON.stringify(bottomMovers || [], null, 2)}

Unusual Volume Stocks:
${JSON.stringify(unusualVolume || [], null, 2)}

Create a comprehensive but concise daily brief.`;

    console.log('[AI Daily Brief] Calling OpenAI API...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
      console.error('[AI Daily Brief] OpenAI API error:', response.status, errorText);
      
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
      console.error('[AI Daily Brief] No content in response');
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response
    let result;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7);
      if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3);
      result = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error('[AI Daily Brief] Failed to parse AI response:', content);
      result = { 
        greeting: `Good morning! Here's your market brief for ${today}`,
        summary: content 
      };
    }

    // Add metadata
    result.generatedAt = new Date().toISOString();
    result.portfolioStats = portfolioStats;

    console.log('[AI Daily Brief] Brief generated successfully');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // SECURITY: Log full error server-side but return safe message to client
    console.error('[AI Daily Brief] Error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred generating your brief' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
