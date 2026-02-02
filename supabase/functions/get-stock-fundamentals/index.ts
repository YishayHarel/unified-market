// Get Stock Fundamentals - Fetches company financials from Finnhub API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
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
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Get-stock-fundamentals function called')
    
    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json()
    } catch (e) {
      console.error('Error parsing request body:', e)
      throw new Error('Invalid request body')
    }
    
    const { symbol } = requestBody
    if (!symbol) {
      throw new Error('symbol is required')
    }
    
    console.log(`Fetching fundamentals for symbol: ${symbol}`)
    
    // Get API key
    const finnhubKey = Deno.env.get('FINNHUB_API_KEY')
    if (!finnhubKey) {
      console.error('FINNHUB_API_KEY not found in environment')
      throw new Error('FINNHUB_API_KEY not found')
    }

    // Fetch all data in parallel
    const [basicFinancialsResponse, profileResponse, recommendationResponse, priceTargetResponse, quoteResponse] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${symbol}&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`)
    ]);

    let fundamentals = {};
    let profile = {};
    let recommendationTrends = [];
    let priceTarget = null;
    let quote = null;

    // Process basic financials
    if (basicFinancialsResponse.ok) {
      const basicData = await basicFinancialsResponse.json();
      console.log(`Basic financials for ${symbol}:`, basicData);
      fundamentals = basicData.metric || {};
    } else {
      console.error(`Error fetching basic financials for ${symbol}: ${basicFinancialsResponse.status}`);
    }

    // Process profile
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      console.log(`Profile for ${symbol}:`, profileData);
      profile = profileData;
    } else {
      console.error(`Error fetching profile for ${symbol}: ${profileResponse.status}`);
    }

    // Process recommendations
    if (recommendationResponse.ok) {
      const recommendationData = await recommendationResponse.json();
      console.log(`Recommendations for ${symbol}:`, recommendationData);
      recommendationTrends = recommendationData || [];
    } else {
      console.error(`Error fetching recommendations for ${symbol}: ${recommendationResponse.status}`);
    }

    // Process price target
    if (priceTargetResponse.ok) {
      const priceTargetData = await priceTargetResponse.json();
      console.log(`Price target for ${symbol}:`, priceTargetData);
      priceTarget = priceTargetData;
    } else {
      console.error(`Error fetching price target for ${symbol}: ${priceTargetResponse.status}`);
    }

    // Process quote
    if (quoteResponse.ok) {
      const quoteData = await quoteResponse.json();
      console.log(`Quote for ${symbol}:`, quoteData);
      quote = quoteData;
    } else {
      console.error(`Error fetching quote for ${symbol}: ${quoteResponse.status}`);
    }

    // Build result with key metrics
    const result = {
      symbol,
      marketCapitalization: (profile as any).marketCapitalization || (fundamentals as any).marketCapitalization || null,
      peRatio: (fundamentals as any).peBasicExclExtraTTM || (fundamentals as any).peTTM || null,
      dividendYield: (fundamentals as any).dividendYieldIndicatedAnnual || (fundamentals as any).dividendYield || null,
      week52High: (fundamentals as any)['52WeekHigh'] || null,
      week52Low: (fundamentals as any)['52WeekLow'] || null,
      beta: (fundamentals as any).beta || null,
      eps: (fundamentals as any).epsBasicExclExtraTTM || null,
      revenue: (fundamentals as any).revenuesPerShareTTM || null,
      industry: (profile as any).finnhubIndustry || null,
      sector: (profile as any).gind || null,
      employeeCount: (profile as any).employeeTotal || null,
      sharesOutstanding: (profile as any).shareOutstanding || null,
      bookValue: (fundamentals as any).bookValuePerShareAnnual || null,
      recommendationTrends,
      priceTarget,
      quote
    };

    console.log(`Returning fundamentals for ${symbol}:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in get-stock-fundamentals function:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
