import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Updates stock prices and calculates daily returns for top 100 stocks
 * This function is designed to be called by a cron job every 4 hours
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting stock price update job...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const finnhubKey = Deno.env.get('FINNHUB_API_KEY');
    if (!finnhubKey) {
      throw new Error('FINNHUB_API_KEY not configured');
    }

    // Fetch top 100 stocks
    const { data: stocks, error: fetchError } = await supabaseClient
      .from('stocks')
      .select('id, symbol')
      .eq('is_top_100', true)
      .limit(100);

    if (fetchError) {
      throw new Error(`Failed to fetch stocks: ${fetchError.message}`);
    }

    if (!stocks || stocks.length === 0) {
      console.log('No top 100 stocks found, fetching all stocks instead');
      const { data: allStocks, error: allError } = await supabaseClient
        .from('stocks')
        .select('id, symbol')
        .order('market_cap', { ascending: false, nullsLast: true })
        .limit(100);
      
      if (allError || !allStocks) {
        throw new Error('No stocks available to update');
      }
      stocks.push(...allStocks);
    }

    console.log(`Updating prices for ${stocks.length} stocks...`);

    let updatedCount = 0;
    let errorCount = 0;
    const batchSize = 5; // Process 5 at a time to respect rate limits
    const delayBetweenBatches = 6000; // 6 seconds between batches (60 calls/min limit)

    for (let i = 0; i < stocks.length; i += batchSize) {
      const batch = stocks.slice(i, i + batchSize);
      
      // Process batch in parallel
      const promises = batch.map(async (stock) => {
        try {
          const response = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${stock.symbol}&token=${finnhubKey}`,
            { headers: { 'User-Agent': 'UnifiedMarket/1.0' } }
          );

          if (response.status === 429) {
            console.warn(`Rate limit hit for ${stock.symbol}`);
            return { symbol: stock.symbol, success: false };
          }

          if (!response.ok) {
            console.error(`Failed to fetch ${stock.symbol}: ${response.status}`);
            return { symbol: stock.symbol, success: false };
          }

          const data = await response.json();
          
          // c = current price, pc = previous close, dp = percent change
          if (data.c && data.c > 0 && data.pc && data.pc > 0) {
            // Calculate daily return as decimal (e.g., 0.02 for 2%)
            const dailyReturn = (data.c - data.pc) / data.pc;
            
            const { error: updateError } = await supabaseClient
              .from('stocks')
              .update({ 
                last_return_1d: dailyReturn,
                updated_at: new Date().toISOString()
              })
              .eq('id', stock.id);

            if (updateError) {
              console.error(`Failed to update ${stock.symbol}: ${updateError.message}`);
              return { symbol: stock.symbol, success: false };
            }

            console.log(`Updated ${stock.symbol}: ${(dailyReturn * 100).toFixed(2)}%`);
            return { symbol: stock.symbol, success: true, return: dailyReturn };
          } else {
            console.log(`No valid price data for ${stock.symbol}`);
            return { symbol: stock.symbol, success: false };
          }
        } catch (err) {
          console.error(`Error processing ${stock.symbol}:`, err);
          return { symbol: stock.symbol, success: false };
        }
      });

      const results = await Promise.all(promises);
      updatedCount += results.filter(r => r.success).length;
      errorCount += results.filter(r => !r.success).length;

      // Wait between batches to respect rate limits
      if (i + batchSize < stocks.length) {
        console.log(`Processed ${i + batchSize}/${stocks.length} stocks, waiting ${delayBetweenBatches/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    console.log(`Stock price update complete. Updated: ${updatedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${updatedCount} stocks`,
        updated: updatedCount,
        errors: errorCount,
        total: stocks.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Stock price update error:', error);
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
