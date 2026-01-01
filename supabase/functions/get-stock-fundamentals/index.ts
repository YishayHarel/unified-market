import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Get-stock-fundamentals function called')
    
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
    
    const finnhubKey = Deno.env.get('FINNHUB_API_KEY')
    if (!finnhubKey) {
      console.error('FINNHUB_API_KEY not found in environment')
      throw new Error('FINNHUB_API_KEY not found')
    }

    // Fetch basic financials, profile, recommendations, price targets, and quote from Finnhub
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

    if (basicFinancialsResponse.ok) {
      const basicData = await basicFinancialsResponse.json();
      console.log(`Basic financials for ${symbol}:`, basicData);
      fundamentals = basicData.metric || {};
    } else {
      console.error(`Error fetching basic financials for ${symbol}: ${basicFinancialsResponse.status}`);
    }

    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      console.log(`Profile for ${symbol}:`, profileData);
      profile = profileData;
    } else {
      console.error(`Error fetching profile for ${symbol}: ${profileResponse.status}`);
    }

    if (recommendationResponse.ok) {
      const recommendationData = await recommendationResponse.json();
      console.log(`Recommendations for ${symbol}:`, recommendationData);
      recommendationTrends = recommendationData || [];
    } else {
      console.error(`Error fetching recommendations for ${symbol}: ${recommendationResponse.status}`);
    }

    if (priceTargetResponse.ok) {
      const priceTargetData = await priceTargetResponse.json();
      console.log(`Price target for ${symbol}:`, priceTargetData);
      priceTarget = priceTargetData;
    } else {
      console.error(`Error fetching price target for ${symbol}: ${priceTargetResponse.status}`);
    }

    if (quoteResponse.ok) {
      const quoteData = await quoteResponse.json();
      console.log(`Quote for ${symbol}:`, quoteData);
      quote = quoteData;
    } else {
      console.error(`Error fetching quote for ${symbol}: ${quoteResponse.status}`);
    }

    // Extract the key metrics we need
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
      // Add recommendation trends and price targets
      recommendationTrends,
      priceTarget,
      quote
    };

    console.log(`Returning fundamentals for ${symbol}:`, result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in get-stock-fundamentals function:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})