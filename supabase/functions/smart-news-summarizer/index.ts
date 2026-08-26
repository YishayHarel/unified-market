import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkSubscription, subscriptionRequiredResponse } from "../_shared/subscription.ts";

// CORS configuration - restrict to allowed origins
const ALLOWED_ORIGINS = [
  'https://unified-market.vercel.app',
  'http://localhost:8080',
  'http://localhost:5173'
];

const AI_NEWS_SUMMARY_DAILY_LIMIT = Number(Deno.env.get('AI_NEWS_SUMMARY_DAILY_LIMIT') ?? '5');
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
    return new Response(JSON.stringify({ error: 'AI is coming soon' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Paid feature: verified before any token is spent.
    const subscription = await checkSubscription(userData.user.email);
    if (!subscription.subscribed) {
      return subscriptionRequiredResponse(subscription, corsHeaders);
    }

    const { data: usageAllowed, error: usageError } = await supabase.rpc('check_ai_usage', {
      p_user_id: userData.user.id,
      p_daily_limit: AI_NEWS_SUMMARY_DAILY_LIMIT
    });
    if (usageError) {
      console.error('[Smart News Summarizer] Usage check error:', usageError);
      return new Response(JSON.stringify({ error: 'Usage check failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!usageAllowed) {
      return new Response(JSON.stringify({ error: 'Daily AI limit reached. Please try again tomorrow.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestedSymbols: string[] = Array.isArray(body.symbols)
      ? body.symbols
          .map((s: unknown) => String(s).replace(/[^A-Za-z0-9.]/g, '').toUpperCase().slice(0, 10))
          .filter(Boolean)
          .slice(0, 25)
      : [];

    // Read the ingest cache rather than trusting articles posted by the client.
    // The caller previously supplied the article list, so the summary covered
    // whatever the client chose to send and could be fed arbitrary text. Reading
    // server-side also means the summary can be scoped to the reader's own
    // holdings, using the ticker tags attached at ingest.
    const userId = userData.user.id;
    let symbols = requestedSymbols;
    if (symbols.length === 0) {
      const [holdings, saved] = await Promise.all([
        supabase.from('portfolio_holdings').select('symbol').eq('user_id', userId),
        supabase.from('user_saved_stocks').select('symbol').eq('user_id', userId).limit(25),
      ]);
      symbols = [
        ...new Set([
          ...(holdings.data ?? []).map((r: { symbol: string }) => r.symbol),
          ...(saved.data ?? []).map((r: { symbol: string }) => r.symbol),
        ]),
      ].slice(0, 25);
    }

    let articleQuery = supabase
      .from('news_articles')
      .select('title, description, source, published_at, tickers')
      .order('published_at', { ascending: false })
      .limit(12);

    // With no symbols to scope by, summarise the general feed instead of
    // returning nothing.
    if (symbols.length > 0) articleQuery = articleQuery.overlaps('tickers', symbols);

    const { data: cachedArticles } = await articleQuery;
    const articles = cachedArticles ?? [];

    if (articles.length === 0) {
      return new Response(
        JSON.stringify({
          error: symbols.length > 0
            ? 'No recent headlines mention your holdings.'
            : 'No headlines available to summarise.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    // Prepare articles for summarization
    const articlesText = articles.map((article, index) =>
      `Article ${index + 1} [${(article.tickers ?? []).join(',') || 'no ticker'}] ` +
      `(${article.source}, ${String(article.published_at).slice(0, 10)}): ` +
      `${article.title}\n${article.description || ''}\n---`
    ).join('\n');

    const prompt = `
Analyze these financial news articles and provide a comprehensive market summary:

${articlesText}

Please provide:
1. Key market themes and trends
2. Major events affecting markets
3. Sector-specific insights
4. Overall market sentiment (bullish/bearish/neutral)
5. Important stocks or companies mentioned
6. Risk factors to watch

Format your response as JSON:
{
  "marketSentiment": "bullish|bearish|neutral",
  "keyThemes": ["theme1", "theme2", "theme3"],
  "majorEvents": [
    {
      "event": "Event description",
      "impact": "Market impact description",
      "affectedSectors": ["Technology", "Healthcare"]
    }
  ],
  "stocksInFocus": [
    {
      "symbol": "AAPL",
      "reason": "Why this stock is noteworthy"
    }
  ],
  "sectorInsights": {
    "Technology": "Sector analysis",
    "Healthcare": "Sector analysis"
  },
  "riskFactors": ["risk1", "risk2"],
  "summary": "Overall market summary in 2-3 sentences",
  "confidence": number (1-10 confidence score)
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
            content: 'You are a financial analyst specializing in market news analysis. Provide concise, actionable insights.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    let summaryResult;
    
    try {
      summaryResult = JSON.parse(aiData.choices[0].message.content);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      summaryResult = {
        marketSentiment: "neutral",
        keyThemes: ["Market Analysis"],
        majorEvents: [],
        stocksInFocus: [],
        sectorInsights: {},
        riskFactors: [],
        summary: aiData.choices[0].message.content,
        confidence: 7
      };
    }

    // Also get individual article summaries
    const articleSummaries = await Promise.all(
      articles.slice(0, 5).map(async (article, index) => {
        try {
          const articleResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                  content: 'Summarize financial news articles in 1-2 sentences, focusing on market impact.' 
                },
                { 
                  role: 'user', 
                  content: `Title: ${article.title}\nDescription: ${article.description || ''}` 
                }
              ],
              max_tokens: 100,
              temperature: 0.3,
            }),
          });

          if (articleResponse.ok) {
            const articleData = await articleResponse.json();
            return {
              title: article.title,
              summary: articleData.choices[0].message.content,
              url: article.url,
              source: article.source?.name || 'Unknown'
            };
          }
        } catch (error) {
          console.error(`Error summarizing article ${index}:`, error);
        }
        
        return {
          title: article.title,
          summary: article.description || 'Summary not available',
          url: article.url,
          source: article.source?.name || 'Unknown'
        };
      })
    );

    return new Response(JSON.stringify({
      marketAnalysis: summaryResult,
      articleSummaries,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in smart news summarizer:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to summarize news', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});