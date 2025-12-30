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
    const { query, userId } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AI Screener] Processing query: "${query}"`);

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Use Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('[AI Screener] LOVABLE_API_KEY not configured');
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

    console.log('[AI Screener] Calling Lovable AI Gateway...');

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
      console.error('[AI Screener] AI Gateway error:', response.status, errorText);
      
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
