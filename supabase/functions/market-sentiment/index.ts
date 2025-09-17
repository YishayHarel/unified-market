import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const finnhubApiKey = Deno.env.get('FINNHUB_API_KEY');
    
    if (!finnhubApiKey) {
      throw new Error('FINNHUB_API_KEY not found');
    }

    // Fetch various market sentiment indicators
    const promises = [
      // VIX (Fear & Greed indicator)
      fetch(`https://finnhub.io/api/v1/quote?symbol=VIX&token=${finnhubApiKey}`),
      // SPY for overall market
      fetch(`https://finnhub.io/api/v1/quote?symbol=SPY&token=${finnhubApiKey}`),
      // Market news sentiment
      fetch(`https://finnhub.io/api/v1/news?category=general&token=${finnhubApiKey}`)
    ];

    const [vixResponse, spyResponse, newsResponse] = await Promise.all(promises);

    if (!vixResponse.ok || !spyResponse.ok || !newsResponse.ok) {
      throw new Error('Failed to fetch market data from Finnhub');
    }

    const [vixData, spyData, newsData] = await Promise.all([
      vixResponse.json(),
      spyResponse.json(),
      newsResponse.json()
    ]);

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

    const fearGreedIndex = calculateFearGreedIndex(vixData.c);

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
      if (vixData.c < 20) score += 20;
      else if (vixData.c > 30) score -= 20;
      
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
        vixLevel: vixData.c
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
          level: vixData.c,
          change: vixData.dp,
          interpretation: vixData.c < 20 ? 'Low volatility (bullish)' : 
                         vixData.c > 30 ? 'High volatility (bearish)' : 'Moderate volatility'
        }
      },
      timestamp: new Date().toISOString(),
      lastUpdated: 'Real-time data from Finnhub'
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