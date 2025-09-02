import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Stock {
  id: number;
  symbol: string;
  name: string;
  market_cap: number | null;
  trending_score: number | null;
  last_return_1d: number | null;
  rel_volume: number | null;
  avg_volume: number | null;
}

interface StockWithScore extends Stock {
  composite_score: number;
}

function calculateCompositeScore(stock: Stock): number {
  let score = 0;
  
  // Market Cap Score (40% weight) - Higher market cap = higher score
  if (stock.market_cap && stock.market_cap > 0) {
    // Log scale for market cap to prevent mega-caps from dominating
    const marketCapScore = Math.log10(stock.market_cap) * 10;
    score += marketCapScore * 0.4;
  }
  
  // Trending Score (25% weight) - Direct trending score
  if (stock.trending_score && stock.trending_score > 0) {
    score += stock.trending_score * 0.25;
  }
  
  // Performance Score (20% weight) - Recent 1-day return
  if (stock.last_return_1d !== null) {
    // Normalize performance: positive returns get bonus, cap extreme values
    const performanceScore = Math.max(-5, Math.min(5, stock.last_return_1d || 0)) + 5;
    score += performanceScore * 0.2;
  }
  
  // Volume Activity Score (15% weight) - Relative volume indicates interest
  if (stock.rel_volume && stock.rel_volume > 0) {
    // Higher relative volume = more interest, cap at reasonable levels
    const volumeScore = Math.min(10, stock.rel_volume);
    score += volumeScore * 0.15;
  }
  
  // Base score for having basic data
  score += 1;
  
  return score;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    console.log('Starting top 100 ranking update...');

    // Fetch all stocks with their current metrics
    const { data: stocks, error: fetchError } = await supabaseClient
      .from('stocks')
      .select('id, symbol, name, market_cap, trending_score, last_return_1d, rel_volume, avg_volume')
      .order('market_cap', { ascending: false, nullsLast: true });

    if (fetchError) {
      throw new Error(`Failed to fetch stocks: ${fetchError.message}`);
    }

    if (!stocks || stocks.length === 0) {
      throw new Error('No stocks found in database');
    }

    console.log(`Processing ${stocks.length} stocks...`);

    // Calculate composite scores for all stocks
    const stocksWithScores: StockWithScore[] = stocks.map(stock => ({
      ...stock,
      composite_score: calculateCompositeScore(stock)
    }));

    // Sort by composite score (highest first)
    stocksWithScores.sort((a, b) => b.composite_score - a.composite_score);

    // Get top 100 stock IDs
    const top100Stocks = stocksWithScores.slice(0, 100);
    const top100Ids = top100Stocks.map(stock => stock.id);

    console.log('Top 10 ranked stocks:');
    top100Stocks.slice(0, 10).forEach((stock, index) => {
      console.log(`${index + 1}. ${stock.symbol} (${stock.name}) - Score: ${stock.composite_score.toFixed(2)}`);
    });

    // First, clear all is_top_100 flags
    const { error: clearError } = await supabaseClient
      .from('stocks')
      .update({ is_top_100: false })
      .neq('id', 0); // Update all rows

    if (clearError) {
      throw new Error(`Failed to clear top 100 flags: ${clearError.message}`);
    }

    // Set is_top_100 = true for top 100 stocks and update their rank_score
    const { error: updateError } = await supabaseClient
      .from('stocks')
      .update({ 
        is_top_100: true,
        last_ranked_at: new Date().toISOString()
      })
      .in('id', top100Ids);

    if (updateError) {
      throw new Error(`Failed to update top 100 flags: ${updateError.message}`);
    }

    // Update rank_score for all stocks based on their position
    const updates = stocksWithScores.map((stock, index) => ({
      id: stock.id,
      rank_score: stock.composite_score,
      last_ranked_at: new Date().toISOString()
    }));

    // Update in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      for (const update of batch) {
        const { error: scoreError } = await supabaseClient
          .from('stocks')
          .update({ 
            rank_score: update.rank_score,
            last_ranked_at: update.last_ranked_at
          })
          .eq('id', update.id);

        if (scoreError) {
          console.error(`Failed to update rank_score for stock ${update.id}: ${scoreError.message}`);
        }
      }
    }

    console.log(`Successfully updated top 100 rankings. Top stock: ${top100Stocks[0]?.symbol} with score ${top100Stocks[0]?.composite_score.toFixed(2)}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully updated top 100 rankings`,
        top_stock: {
          symbol: top100Stocks[0]?.symbol,
          name: top100Stocks[0]?.name,
          score: top100Stocks[0]?.composite_score
        },
        total_stocks_processed: stocks.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Top 100 ranking error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})