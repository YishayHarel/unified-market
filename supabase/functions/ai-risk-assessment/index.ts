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
const MAX_REQUESTS_PER_MINUTE = 10; // AI calls are expensive

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
      console.error('[AI Risk Assessment] Auth error:', authError?.message);
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

    console.log(`[AI Risk Assessment] Processing for authenticated user: ${userId.substring(0, 8)}...`);

    // Fetch user's portfolio - now using verified userId
    const { data: holdings, error: holdingsError } = await supabase
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', userId);

    if (holdingsError) {
      console.error('[AI Risk Assessment] Error fetching holdings:', holdingsError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch portfolio' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!holdings || holdings.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No portfolio holdings found',
          suggestion: 'Add some holdings to your portfolio to get risk assessment'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate portfolio value and weights
    const portfolioData = holdings.map(h => ({
      symbol: h.symbol,
      name: h.company_name,
      sector: h.sector || 'Unknown',
      shares: h.shares,
      avgCost: h.avg_cost,
      currentPrice: h.current_price || h.avg_cost,
      value: h.shares * (h.current_price || h.avg_cost),
      gainLoss: ((h.current_price || h.avg_cost) - h.avg_cost) / h.avg_cost * 100
    }));

    const totalValue = portfolioData.reduce((sum, h) => sum + h.value, 0);
    const portfolioWithWeights = portfolioData.map(h => ({
      ...h,
      weight: (h.value / totalValue * 100).toFixed(2) + '%'
    }));

    // Use OpenAI API
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      console.error('[AI Risk Assessment] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a portfolio risk analyst AI. Analyze the user's portfolio and provide:

1. Overall risk score (1-10, 10 being highest risk)
2. Key risk factors identified
3. Concentration risk analysis
4. Sector exposure analysis
5. Specific recommendations for risk mitigation

Format your response as JSON:
{
  "riskScore": 7,
  "riskLevel": "High" | "Moderate" | "Low",
  "summary": "Brief overall assessment",
  "riskFactors": [
    { "factor": "Description", "severity": "High" | "Medium" | "Low", "impact": "What could happen" }
  ],
  "concentrationAnalysis": {
    "topHolding": { "symbol": "AAPL", "weight": "45%", "concern": "Description" },
    "diversificationScore": "Poor" | "Fair" | "Good" | "Excellent"
  },
  "sectorExposure": [
    { "sector": "Technology", "weight": "60%", "risk": "High" | "Medium" | "Low" }
  ],
  "recommendations": [
    { "action": "What to do", "priority": "High" | "Medium" | "Low", "rationale": "Why" }
  ],
  "hedgingStrategies": [
    { "strategy": "Description", "instruments": ["SPY puts", "VIX calls"], "cost": "Estimated cost" }
  ]
}

Always return valid JSON only.`;

    const userPrompt = `Analyze this portfolio for risks:

Total Portfolio Value: $${totalValue.toFixed(2)}
Number of Holdings: ${portfolioWithWeights.length}

Holdings:
${JSON.stringify(portfolioWithWeights, null, 2)}

Provide a comprehensive risk assessment.`;

    console.log('[AI Risk Assessment] Calling OpenAI API...');

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
      console.error('[AI Risk Assessment] OpenAI API error:', response.status, errorText);
      
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
      console.error('[AI Risk Assessment] No content in response');
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
      console.error('[AI Risk Assessment] Failed to parse AI response:', content);
      result = { summary: content, riskScore: 5, riskLevel: 'Unknown' };
    }

    // Add portfolio summary to response
    result.portfolio = {
      totalValue,
      holdingsCount: portfolioWithWeights.length,
      holdings: portfolioWithWeights
    };

    console.log(`[AI Risk Assessment] Risk score: ${result.riskScore}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // SECURITY: Log full error server-side but return safe message to client
    console.error('[AI Risk Assessment] Error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
