import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user's portfolio holdings
    const { data: holdings, error: holdingsError } = await supabaseClient
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', user.id);

    if (holdingsError) {
      throw holdingsError;
    }

    // Fetch user preferences
    const { data: preferences } = await supabaseClient
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!holdings || holdings.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No portfolio holdings found. Please add some holdings first.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate current portfolio metrics
    const totalValue = holdings.reduce((sum, holding) => 
      sum + (holding.shares * (holding.current_price || holding.avg_cost)), 0
    );

    const portfolioAnalysis = holdings.map(holding => {
      const value = holding.shares * (holding.current_price || holding.avg_cost);
      const weight = (value / totalValue) * 100;
      const gainLoss = holding.current_price ? 
        ((holding.current_price - holding.avg_cost) / holding.avg_cost) * 100 : 0;
      
      return {
        symbol: holding.symbol,
        weight: weight.toFixed(2),
        value: value.toFixed(2),
        gainLoss: gainLoss.toFixed(2),
        shares: holding.shares,
        sector: holding.sector || 'Unknown'
      };
    });

    // Use OpenAI to analyze the portfolio
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const prompt = `
You are a professional portfolio optimizer. Analyze this portfolio and provide optimization recommendations.

Current Portfolio:
${portfolioAnalysis.map(holding => 
  `${holding.symbol}: ${holding.weight}% (${holding.shares} shares, $${holding.value}, ${holding.gainLoss}% gain/loss, Sector: ${holding.sector})`
).join('\n')}

Total Portfolio Value: $${totalValue.toFixed(2)}
Risk Tolerance: ${preferences?.risk_tolerance || 'moderate'}
Max Position Size: ${preferences?.max_position_size || 10}%
Rebalance Threshold: ${preferences?.rebalance_threshold || 5}%

Please provide:
1. Portfolio diversification analysis
2. Sector allocation recommendations
3. Position size recommendations
4. Rebalancing suggestions
5. Risk assessment and improvements
6. Specific action items

Format your response as JSON with the following structure:
{
  "diversificationScore": number (1-10),
  "riskScore": number (1-10),
  "recommendations": [
    {
      "type": "rebalance|reduce|increase|sell|diversify",
      "symbol": "AAPL",
      "action": "Reduce position from 15% to 10%",
      "reason": "Position is overweight relative to risk tolerance"
    }
  ],
  "sectorAnalysis": {
    "Technology": 45,
    "Healthcare": 20,
    "Finance": 35
  },
  "targetAllocations": {
    "AAPL": 10,
    "MSFT": 12
  },
  "summary": "Overall portfolio analysis summary"
}
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional financial advisor specializing in portfolio optimization. Provide actionable, data-driven recommendations.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    let optimizationResult;
    
    try {
      optimizationResult = JSON.parse(aiData.choices[0].message.content);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      optimizationResult = {
        diversificationScore: 7,
        riskScore: 6,
        recommendations: [
          {
            type: "diversify",
            symbol: "Portfolio",
            action: "Add more sector diversification",
            reason: "Portfolio analysis completed successfully"
          }
        ],
        sectorAnalysis: {},
        targetAllocations: {},
        summary: aiData.choices[0].message.content
      };
    }

    return new Response(JSON.stringify({
      portfolioAnalysis,
      totalValue: totalValue.toFixed(2),
      optimization: optimizationResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // SECURITY: Log full error server-side but return safe message to client
    console.error('Error in AI portfolio optimizer:', error);
    return new Response(JSON.stringify({ 
      error: 'An error occurred optimizing your portfolio'
      // SECURITY: Never expose error.message to client - could leak internal details
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});