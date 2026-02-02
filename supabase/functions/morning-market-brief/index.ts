import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// CORS configuration - restrict to allowed origins
const ALLOWED_ORIGINS = [
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
function getSentimentTier(futures: FuturesData[], vix: { value: number; change: number } | null): { 
  sentiment: string; 
  confidence: number;
  direction: string;
  action: string;
} {
  // Calculate average futures change
  const avgFuturesChange = futures.length > 0 
    ? futures.reduce((sum, f) => sum + f.changePercent, 0) / futures.length 
    : 0;
  
  // VIX interpretation (higher = more fear)
  const vixLevel = vix?.value || 20;
  const vixChange = vix?.change || 0;
  
  // Determine sentiment tier
  let sentiment: string;
  let confidence: number;
  let direction: string;
  let action: string;
  
  if (avgFuturesChange > 1.5) {
    sentiment = 'Very Bullish';
    confidence = Math.min(95, 70 + Math.abs(avgFuturesChange) * 10);
    direction = 'Strong upward momentum expected';
    action = 'Consider buying on dips';
  } else if (avgFuturesChange > 0.7) {
    sentiment = 'Bullish';
    confidence = Math.min(90, 60 + Math.abs(avgFuturesChange) * 10);
    direction = 'Market trending higher';
    action = 'Hold positions, consider adding';
  } else if (avgFuturesChange > 0.2) {
    sentiment = 'Slightly Bullish';
    confidence = Math.min(80, 55 + Math.abs(avgFuturesChange) * 10);
    direction = 'Modest upside expected';
    action = 'Hold current positions';
  } else if (avgFuturesChange >= -0.2) {
    sentiment = 'Neutral';
    confidence = 50 + Math.random() * 10;
    direction = 'Sideways trading expected';
    action = 'Wait for clearer signals';
  } else if (avgFuturesChange > -0.7) {
    sentiment = 'Slightly Bearish';
    confidence = Math.min(80, 55 + Math.abs(avgFuturesChange) * 10);
    direction = 'Minor downside pressure';
    action = 'Consider defensive positions';
  } else if (avgFuturesChange > -1.5) {
    sentiment = 'Bearish';
    confidence = Math.min(90, 60 + Math.abs(avgFuturesChange) * 10);
    direction = 'Market trending lower';
    action = 'Consider reducing exposure';
  } else {
    sentiment = 'Very Bearish';
    confidence = Math.min(95, 70 + Math.abs(avgFuturesChange) * 10);
    direction = 'Strong downward pressure';
    action = 'Consider selling or hedging';
  }
  
  // Adjust for VIX
  if (vixLevel > 30 && vixChange > 2) {
    confidence = Math.max(confidence - 10, 40);
    action = 'High volatility - trade with caution';
  } else if (vixLevel < 15) {
    confidence = Math.min(confidence + 5, 95);
  }
  
  return { sentiment, confidence: Math.round(confidence), direction, action };
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
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Morning Brief] Generating brief for user: ${userId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const alphaVantageKey = Deno.env.get('ALPHA_VANTAGE_API_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

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
    const marketSentiment = getSentimentTier(futuresData, vixData);

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

    const systemPrompt = `You are a professional market analyst providing the Morning Market Brief at 8:30 AM ET, before market open.

Your analysis must include:
1. Pre-market summary with futures, VIX, and Treasury analysis
2. 30-minute opening direction prediction (where market should head in first 30 min)
3. Overall market sentiment using the 7-tier scale with confidence %
4. Individual stock predictions for each stock the user owns (if any)

IMPORTANT RULES:
- Use the 7-tier sentiment scale: Very Bullish, Bullish, Slightly Bullish, Neutral, Slightly Bearish, Bearish, Very Bearish
- Always include a confidence percentage (0-100%)
- For the 30-minute prediction, give a clear BUY, SELL, or HOLD recommendation
- For each owned stock, provide a specific prediction with sentiment and confidence %
- Be concise but informative
- Focus on actionable insights

Return valid JSON in this EXACT format:
{
  "greeting": "Good morning! Here's your Morning Market Brief for [date]",
  "generatedTime": "8:30 AM ET",
  "preMarketSummary": {
    "headline": "Brief 1-line market headline",
    "futuresAnalysis": "Analysis of futures movement",
    "vixAnalysis": "What VIX level means for today",
    "treasuryAnalysis": "Yield curve interpretation"
  },
  "marketSentiment": {
    "tier": "Bullish",
    "confidence": 75,
    "reasoning": "Brief explanation"
  },
  "thirtyMinutePrediction": {
    "direction": "UP" | "DOWN" | "FLAT",
    "confidence": 70,
    "action": "BUY" | "SELL" | "HOLD",
    "reasoning": "Why we expect this direction"
  },
  "stockPredictions": [
    {
      "symbol": "AAPL",
      "companyName": "Apple Inc",
      "sentiment": "Slightly Bullish",
      "confidence": 65,
      "priceTarget": "Expected to open +0.5% to +1%",
      "reasoning": "Brief reasoning",
      "action": "HOLD"
    }
  ],
  "keyWatchPoints": ["Watch point 1", "Watch point 2"],
  "riskFactors": ["Risk 1", "Risk 2"],
  "closingAdvice": "Brief closing advice"
}`;

    const userPrompt = `Generate a Morning Market Brief for ${today}.

CURRENT MARKET DATA:
Futures:
${JSON.stringify(futuresData, null, 2)}

VIX: ${vixData ? `${vixData.value.toFixed(2)} (${vixData.change >= 0 ? '+' : ''}${vixData.change.toFixed(2)})` : 'N/A'}

Treasury Yields:
- 2-Year: ${treasury2Y ? `${treasury2Y.value.toFixed(2)}% (${treasury2Y.change >= 0 ? '+' : ''}${treasury2Y.change.toFixed(3)}%)` : 'N/A'}
- 10-Year: ${treasury10Y ? `${treasury10Y.value.toFixed(2)}% (${treasury10Y.change >= 0 ? '+' : ''}${treasury10Y.change.toFixed(3)}%)` : 'N/A'}
- Yield Spread (10Y-2Y): ${yieldSpread !== null ? `${yieldSpread.toFixed(2)}%` : 'N/A'}

USER'S PORTFOLIO (${holdings.length} holdings):
${holdings.length > 0 ? JSON.stringify(holdings, null, 2) : 'No holdings'}

Portfolio Stats: ${portfolioStats ? JSON.stringify(portfolioStats) : 'N/A'}

USER'S WATCHLIST (${savedStocks.length} stocks):
${JSON.stringify(savedStocks, null, 2)}

TODAY'S TOP MOVERS:
${JSON.stringify(topMovers, null, 2)}

TODAY'S BOTTOM MOVERS:
${JSON.stringify(bottomMovers, null, 2)}

${holdings.length > 0 ? `
IMPORTANT: The user owns ${holdings.length} stocks. You MUST include a prediction for EACH stock they own in the stockPredictions array with sentiment, confidence %, and action (BUY/SELL/HOLD).
` : 'The user has no stock holdings, so skip the stockPredictions section.'}

Provide a comprehensive Morning Market Brief.`;

    console.log('[Morning Brief] Calling OpenAI API...');

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
        max_tokens: 2500,
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
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7);
      if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3);
      result = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error('[Morning Brief] Failed to parse AI response:', content);
      // Return fallback with raw market data
      result = {
        greeting: `Good morning! Here's your Morning Market Brief for ${today}`,
        error: 'Failed to generate full analysis',
        rawSummary: content
      };
    }

    // Add metadata and raw market data
    result.generatedAt = new Date().toISOString();
    result.marketData = marketData;
    result.portfolioStats = portfolioStats;
    result.calculatedSentiment = marketSentiment;

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
