import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// CORS configuration - restrict to allowed origins
const ALLOWED_ORIGINS = [
  'https://85a34aed-b2cd-4a8b-8664-ff1b782adf81.lovableproject.com',
  'https://lovable.dev',
  'https://unified-market.vercel.app',
  'http://localhost:8080',
  'http://localhost:5173'
];

const AI_DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '20');

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

    // Fetch available stocks data for context
    const { data: stocks, error: stocksError } = await supabase
      .from('stocks')
      .select('symbol, name, market_cap, last_return_1d, avg_volume, rel_volume')
      .order('market_cap', { ascending: false, nullsFirst: false })
      .limit(200);

    if (stocksError) {
      console.error('[AI Screener] Error fetching stocks:', stocksError);
    }

    const stockContext = stocks?.map(s => ({
      symbol: s.symbol,
      name: s.name,
      marketCap: s.market_cap,
      dayChange: s.last_return_1d,
      avgVolume: s.avg_volume,
      relVolume: s.rel_volume
    })) || [];

    // Use OpenAI API
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      console.error('[AI Screener] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an AI stock screener assistant. Users will describe stocks they're looking for in natural language.

Your job is to:
1. Understand what the user is looking for
2. Analyze the provided stock data
3. Return stocks that match their criteria
4. Explain why each stock matches

Available stock data includes: symbol, name, market cap, daily change %, average volume, and relative volume.

Format your response as JSON with this structure:
{
  "interpretation": "Brief explanation of what criteria you understood",
  "matches": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "reason": "Why this stock matches the criteria",
      "metrics": { "marketCap": "$3T", "dayChange": "+1.5%", "relVolume": "1.2x" }
    }
  ],
  "summary": "Brief summary of the search results"
}

If no stocks match, return an empty matches array with an explanation in summary.
Always return valid JSON only, no markdown.`;

    const userPrompt = `User query: "${query}"

Available stocks data:
${JSON.stringify(stockContext.slice(0, 100), null, 2)}

Find stocks matching the user's criteria and return the results as JSON.`;

    console.log('[AI Screener] Calling OpenAI API...');

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
