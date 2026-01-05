import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS (public edge function; allow all origins)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};


// Rate limiting - prevent abuse
interface RateLimit {
  count: number;
  resetTime: number;
}
const rateLimits = new Map<string, RateLimit>();
const MAX_REQUESTS_PER_MINUTE = 15;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const limit = rateLimits.get(identifier);

  if (!limit || now > limit.resetTime) {
    rateLimits.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - 1 };
  }

  if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
    return { allowed: false, remaining: 0 };
  }

  limit.count++;
  rateLimits.set(identifier, limit);
  return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - limit.count };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }


  try {
    // Rate limiting by IP
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please wait before making more requests.' }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } 
        }
      );
    }

    console.log(`Market-sentiment called (IP: ${clientIP}, remaining: ${rateCheck.remaining})`);

    const finnhubApiKey = Deno.env.get('FINNHUB_API_KEY');
    
    if (!finnhubApiKey) {
      throw new Error('FINNHUB_API_KEY not found');
    }

    // Fetch various market sentiment indicators
    // Note: Finnhub uses CBOE VIX index - we'll use UVXY as VIX proxy for real-time data
    const promises = [
      // UVXY (VIX ETF as proxy for volatility)
      fetch(`https://finnhub.io/api/v1/quote?symbol=UVXY&token=${finnhubApiKey}`),
      // SPY for overall market
      fetch(`https://finnhub.io/api/v1/quote?symbol=SPY&token=${finnhubApiKey}`),
      // Market news sentiment
      fetch(`https://finnhub.io/api/v1/news?category=general&token=${finnhubApiKey}`),
      // VXX as alternative VIX proxy
      fetch(`https://finnhub.io/api/v1/quote?symbol=VXX&token=${finnhubApiKey}`)
    ];

    const [uvxyResponse, spyResponse, newsResponse, vxxResponse] = await Promise.all(promises);

    if (!spyResponse.ok || !newsResponse.ok) {
      throw new Error('Failed to fetch market data from Finnhub');
    }

    const [uvxyData, spyData, newsData, vxxData] = await Promise.all([
      uvxyResponse.ok ? uvxyResponse.json() : null,
      spyResponse.json(),
      newsResponse.json(),
      vxxResponse.ok ? vxxResponse.json() : null
    ]);

    // Calculate implied VIX level from UVXY or VXX changes
    // UVXY typically moves 1.5x VIX, VXX moves roughly 1x
    const getVolatilityMetrics = () => {
      if (uvxyData && uvxyData.c && uvxyData.pc) {
        const uvxyChange = ((uvxyData.c - uvxyData.pc) / uvxyData.pc) * 100;
        // Estimate VIX level based on UVXY behavior (typical range 12-35)
        // UVXY price correlates loosely with VIX
        const estimatedVix = Math.max(12, Math.min(50, 15 + (uvxyChange * 0.5)));
        return {
          level: estimatedVix,
          change: uvxyChange / 1.5, // Approximate VIX change
          source: 'UVXY'
        };
      }
      if (vxxData && vxxData.c && vxxData.pc) {
        const vxxChange = ((vxxData.c - vxxData.pc) / vxxData.pc) * 100;
        const estimatedVix = Math.max(12, Math.min(50, 15 + (vxxChange * 0.3)));
        return {
          level: estimatedVix,
          change: vxxChange,
          source: 'VXX'
        };
      }
      // Fallback: estimate from SPY volatility
      const spyChange = Math.abs(((spyData.c - spyData.pc) / spyData.pc) * 100);
      const estimatedVix = Math.max(12, Math.min(40, 15 + (spyChange * 3)));
      return {
        level: estimatedVix,
        change: spyChange > 1 ? 5 : -2,
        source: 'SPY-derived'
      };
    };

    const volatilityMetrics = getVolatilityMetrics();

    // Calculate Fear & Greed Index based on VIX
    const calculateFearGreedIndex = (vixLevel) => {
      // VIX interpretation: 
      // 0-12: Extreme Greed, 12-20: Greed, 20-30: Neutral, 30-40: Fear, 40+: Extreme Fear
      if (vixLevel <= 12) return { score: 85, label: 'Extreme Greed' };
      if (vixLevel <= 20) return { score: 70, label: 'Greed' };
      if (vixLevel <= 30) return { score: 50, label: 'Neutral' };
      if (vixLevel <= 40) return { score: 30, label: 'Fear' };
      return { score: 15, label: 'Extreme Fear' };
    };

    const fearGreedIndex = calculateFearGreedIndex(volatilityMetrics.level);

    // Calculate market momentum
    const spyChange = ((spyData.c - spyData.pc) / spyData.pc) * 100;
    
    // Analyze recent news sentiment using basic keyword analysis
    const analyzeSentiment = (articles) => {
      const positiveWords = ['gain', 'rise', 'bull', 'growth', 'strong', 'optimistic', 'rally', 'surge'];
      const negativeWords = ['fall', 'drop', 'bear', 'decline', 'weak', 'pessimistic', 'crash', 'plunge'];
      
      let positiveCount = 0;
      let negativeCount = 0;
      
      articles.slice(0, 20).forEach(article => {
        const text = (article.headline + ' ' + (article.summary || '')).toLowerCase();
        positiveWords.forEach(word => {
          if (text.includes(word)) positiveCount++;
        });
        negativeWords.forEach(word => {
          if (text.includes(word)) negativeCount++;
        });
      });
      
      const total = positiveCount + negativeCount;
      if (total === 0) return 'Neutral';
      
      const ratio = positiveCount / total;
      if (ratio > 0.6) return 'Positive';
      if (ratio < 0.4) return 'Negative';
      return 'Neutral';
    };

    const newsSentiment = analyzeSentiment(newsData);

    // Calculate overall market health score
    const calculateMarketHealth = () => {
      let score = 50; // Start neutral
      
      // VIX factor (lower is better)
      if (volatilityMetrics.level < 20) score += 20;
      else if (volatilityMetrics.level > 30) score -= 20;
      
      // SPY momentum factor
      if (spyChange > 1) score += 15;
      else if (spyChange < -1) score -= 15;
      
      // News sentiment factor
      if (newsSentiment === 'Positive') score += 10;
      else if (newsSentiment === 'Negative') score -= 10;
      
      return Math.max(0, Math.min(100, score));
    };

    const marketHealthScore = calculateMarketHealth();

    // Get sector rotation data
    const sectorETFs = ['XLK', 'XLF', 'XLV', 'XLE', 'XLI', 'XLP', 'XLU', 'XLB', 'XLRE'];
    const sectorPromises = sectorETFs.map(etf => 
      fetch(`https://finnhub.io/api/v1/quote?symbol=${etf}&token=${finnhubApiKey}`)
    );

    const sectorResponses = await Promise.all(sectorPromises);
    const sectorData = await Promise.all(
      sectorResponses.map(response => response.ok ? response.json() : null)
    );

    const sectorPerformance = sectorETFs.map((etf, index) => {
      const data = sectorData[index];
      if (!data) return { sector: etf, change: 0 };
      
      return {
        sector: etf,
        change: ((data.c - data.pc) / data.pc) * 100,
        price: data.c
      };
    }).sort((a, b) => b.change - a.change);

    const result = {
      fearGreedIndex: {
        score: fearGreedIndex.score,
        label: fearGreedIndex.label,
        vixLevel: volatilityMetrics.level
      },
      marketMomentum: {
        spyChange: spyChange.toFixed(2),
        spyPrice: spyData.c,
        direction: spyChange > 0 ? 'Up' : spyChange < 0 ? 'Down' : 'Flat'
      },
      newsSentiment: {
        overall: newsSentiment,
        analysisNote: 'Based on recent financial news headlines'
      },
      marketHealthScore: {
        score: marketHealthScore,
        label: marketHealthScore > 70 ? 'Healthy' : marketHealthScore > 40 ? 'Neutral' : 'Unhealthy'
      },
      sectorRotation: {
        leaders: sectorPerformance.slice(0, 3),
        laggards: sectorPerformance.slice(-3),
        all: sectorPerformance
      },
      indicators: {
        vix: {
          level: volatilityMetrics.level,
          change: volatilityMetrics.change,
          interpretation: volatilityMetrics.level < 20 ? 'Low volatility (bullish)' : 
                         volatilityMetrics.level > 30 ? 'High volatility (bearish)' : 'Moderate volatility',
          source: volatilityMetrics.source
        }
      },
      timestamp: new Date().toISOString(),
      lastUpdated: `Real-time data from Finnhub (VIX via ${volatilityMetrics.source})`
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in market sentiment function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch market sentiment data', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});