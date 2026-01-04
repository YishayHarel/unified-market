import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

interface SavedStock {
  symbol: string;
  name: string | null;
}

interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
}

interface NewsArticle {
  headline: string;
  summary: string;
  source: string;
  datetime: number;
  url: string;
  symbol?: string;
}

interface SmartAlert {
  type: 'big_move' | 'stock_news' | 'market_news';
  symbol?: string;
  title: string;
  message: string;
  url?: string;
}

// Thresholds for "big moves"
const BIG_MOVE_THRESHOLD = 5; // 5% daily change
const VOLUME_SPIKE_THRESHOLD = 3; // 3x average volume

// Keywords that indicate major market-moving news
const MAJOR_NEWS_KEYWORDS = [
  'fed', 'federal reserve', 'rate cut', 'rate hike', 'interest rate',
  'recession', 'crash', 'crisis', 'emergency', 'breaking',
  'war', 'tariff', 'sanctions', 'default', 'inflation',
  'gdp', 'unemployment', 'jobs report', 'cpi', 'fomc',
  's&p 500', 'dow jones', 'nasdaq', 'market crash', 'circuit breaker',
  'earnings shock', 'bankruptcy', 'merger', 'acquisition'
];

async function fetchPrices(symbols: string[], apiKey: string): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>();
  if (symbols.length === 0) return results;
  
  const batchSize = 8;
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const symbolsParam = batch.join(',');
    
    try {
      const response = await fetch(
        `https://api.twelvedata.com/quote?symbol=${symbolsParam}&apikey=${apiKey}`,
        { headers: { 'User-Agent': 'UnifiedMarket/1.0' } }
      );
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (batch.length === 1) {
        const symbol = batch[0];
        if (data.close && data.close !== 'null') {
          results.set(symbol, {
            symbol,
            price: parseFloat(data.close),
            change: parseFloat(data.change || '0'),
            changePercent: parseFloat(data.percent_change || '0'),
            volume: parseInt(data.volume || '0', 10),
            avgVolume: parseInt(data.average_volume || '0', 10)
          });
        }
      } else {
        for (const symbol of batch) {
          const symbolData = data[symbol];
          if (symbolData?.close && symbolData.close !== 'null' && !symbolData.code) {
            results.set(symbol, {
              symbol,
              price: parseFloat(symbolData.close),
              change: parseFloat(symbolData.change || '0'),
              changePercent: parseFloat(symbolData.percent_change || '0'),
              volume: parseInt(symbolData.volume || '0', 10),
              avgVolume: parseInt(symbolData.average_volume || '0', 10)
            });
          }
        }
      }
      
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`Fetch error for batch:`, error);
    }
  }
  
  return results;
}

async function fetchStockNews(symbols: string[], finnhubKey: string): Promise<NewsArticle[]> {
  const allNews: NewsArticle[] = [];
  const today = new Date();
  const dayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const fromDate = dayAgo.toISOString().split('T')[0];
  const toDate = today.toISOString().split('T')[0];
  
  // Limit to first 5 symbols to avoid rate limits
  const symbolsToCheck = symbols.slice(0, 5);
  
  for (const symbol of symbolsToCheck) {
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${finnhubKey}`,
        { headers: { 'User-Agent': 'UnifiedMarket/1.0' } }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          // Only get news from last 2 hours
          const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
          const recentNews = data
            .filter((article: any) => article.datetime * 1000 > twoHoursAgo)
            .slice(0, 3) // Max 3 per symbol
            .map((article: any) => ({ ...article, symbol }));
          allNews.push(...recentNews);
        }
      }
      
      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error fetching news for ${symbol}:`, error);
    }
  }
  
  return allNews;
}

async function fetchMarketNews(finnhubKey: string): Promise<NewsArticle[]> {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`,
      { headers: { 'User-Agent': 'UnifiedMarket/1.0' } }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    
    // Only get news from last 2 hours
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    return data.filter((article: any) => article.datetime * 1000 > twoHoursAgo);
  } catch (error) {
    console.error('Error fetching market news:', error);
    return [];
  }
}

function isMajorNews(article: NewsArticle): boolean {
  const text = `${article.headline} ${article.summary}`.toLowerCase();
  return MAJOR_NEWS_KEYWORDS.some(keyword => text.includes(keyword));
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const twelveDataKey = Deno.env.get('TWELVE_DATA_API_KEY');
    const finnhubKey = Deno.env.get('FINNHUB_API_KEY');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user token
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking smart alerts for user: ${user.id}`);

    // Get request body for last check timestamp
    let lastCheckTime = 0;
    try {
      const body = await req.json();
      lastCheckTime = body.lastCheckTime || 0;
    } catch (e) {
      // No body, use default
    }

    // Fetch user's saved stocks
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: savedStocks, error: stocksError } = await supabase
      .from('user_saved_stocks')
      .select('symbol, name')
      .eq('user_id', user.id);

    if (stocksError) {
      console.error('Error fetching saved stocks:', stocksError);
      throw stocksError;
    }

    const alerts: SmartAlert[] = [];
    const symbols = (savedStocks || []).map((s: SavedStock) => s.symbol);
    
    console.log(`User has ${symbols.length} saved stocks: ${symbols.join(', ')}`);

    // 1. Check for big moves on saved stocks
    if (symbols.length > 0 && twelveDataKey) {
      const prices = await fetchPrices(symbols, twelveDataKey);
      console.log(`Fetched prices for ${prices.size} symbols`);
      
      for (const [symbol, priceData] of prices) {
        const absChange = Math.abs(priceData.changePercent);
        
        // Check for big price move
        if (absChange >= BIG_MOVE_THRESHOLD) {
          const direction = priceData.changePercent > 0 ? 'up' : 'down';
          const emoji = priceData.changePercent > 0 ? '📈' : '📉';
          
          alerts.push({
            type: 'big_move',
            symbol,
            title: `${emoji} ${symbol} Big Move`,
            message: `${symbol} is ${direction} ${absChange.toFixed(1)}% today ($${priceData.price.toFixed(2)})`
          });
          
          console.log(`Big move alert: ${symbol} ${direction} ${absChange.toFixed(1)}%`);
        }
        
        // Check for volume spike
        if (priceData.avgVolume > 0) {
          const volumeRatio = priceData.volume / priceData.avgVolume;
          if (volumeRatio >= VOLUME_SPIKE_THRESHOLD) {
            alerts.push({
              type: 'big_move',
              symbol,
              title: `📊 ${symbol} Volume Spike`,
              message: `${symbol} volume is ${volumeRatio.toFixed(1)}x above average`
            });
            
            console.log(`Volume spike: ${symbol} ${volumeRatio.toFixed(1)}x`);
          }
        }
      }
    }

    // 2. Check for news on saved stocks
    if (symbols.length > 0 && finnhubKey) {
      const stockNews = await fetchStockNews(symbols, finnhubKey);
      console.log(`Found ${stockNews.length} recent news articles for saved stocks`);
      
      for (const article of stockNews) {
        // Skip if we already notified about this (within last check)
        if (article.datetime * 1000 < lastCheckTime) continue;
        
        alerts.push({
          type: 'stock_news',
          symbol: article.symbol,
          title: `📰 ${article.symbol} News`,
          message: article.headline.slice(0, 100),
          url: article.url
        });
      }
    }

    // 3. Check for major market news
    if (finnhubKey) {
      const marketNews = await fetchMarketNews(finnhubKey);
      console.log(`Found ${marketNews.length} recent market news articles`);
      
      for (const article of marketNews) {
        // Skip if we already notified about this
        if (article.datetime * 1000 < lastCheckTime) continue;
        
        if (isMajorNews(article)) {
          alerts.push({
            type: 'market_news',
            title: '🚨 Market Alert',
            message: article.headline.slice(0, 100),
            url: article.url
          });
          
          console.log(`Major news: ${article.headline.slice(0, 50)}...`);
        }
      }
    }

    // Limit alerts to avoid notification spam
    const limitedAlerts = alerts.slice(0, 5);
    
    console.log(`Returning ${limitedAlerts.length} alerts (from ${alerts.length} total)`);

    return new Response(
      JSON.stringify({ 
        alerts: limitedAlerts,
        savedStocksCount: symbols.length,
        checkTime: Date.now()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in smart-alerts:', error);
    return new Response(
      JSON.stringify({ error: error.message, alerts: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
