import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AI Risk Assessment] Processing for user: ${userId}`);

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user's portfolio
    const { data: holdings, error: holdingsError } = await supabase
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', userId);

    if (holdingsError) {
      console.error('[AI Risk Assessment] Error fetching holdings:', holdingsError);
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

    // Use Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('[AI Risk Assessment] LOVABLE_API_KEY not configured');
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

    console.log('[AI Risk Assessment] Calling Lovable AI Gateway...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Risk Assessment] AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    console.error('[AI Risk Assessment] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
