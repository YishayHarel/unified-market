import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { TOP_100_SYMBOLS, COMPANY_NAMES } from '../_shared/top100.ts'

// CORS configuration - restrict to allowed origins
const ALLOWED_ORIGINS = [
  // The production origin was absent, so browser calls to this function failed
  // CORS on the live site and only ever worked from a developer machine.
  'https://unified-market.vercel.app',
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



interface StockRow {
  symbol: string;
  name: string;
  market_cap: number | null;
  last_return_1d: number | null;
}

/**
 * This job no longer calls Finnhub at all.
 *
 * It used to fire 200 metered calls — a quote and a profile for each of 100
 * symbols — in bursts of ten with a half-second pause, roughly 240 a minute
 * against a 60-a-minute allowance. Finnhub throttled whole contiguous blocks,
 * so only 60 of the 100 symbols ever landed and the "Top 100" was a top 60.
 * Pacing the calls did not fix it either: the retries on 429 are themselves
 * calls, so a burst that trips the limiter keeps tripping it, and a paced run
 * still lost 36 symbols in two solid blocks.
 *
 * Market caps now come from the table, kept fresh by update-market-caps, which
 * is incremental and resumable and can afford to be slow. Daily returns come
 * from Yahoo, which is keyless and unmetered. So this job is fast, complete,
 * and cannot be rate-limited into a partial list.
 */
const YAHOO_CONCURRENCY = 10;

/** A daily move this large or bigger earns full marks on the momentum half. */
const FULL_MOVE = 0.05;

/** How much of the composite score is size rather than today's move. */
const SIZE_WEIGHT = 0.7;

/** Today's move as a decimal fraction, from Yahoo's keyless chart endpoint. */
async function fetchDailyReturns(symbols: string[]): Promise<Map<string, number>> {
  const returns = new Map<string, number>();

  for (let i = 0; i < symbols.length; i += YAHOO_CONCURRENCY) {
    const batch = symbols.slice(i, i + YAHOO_CONCURRENCY);

    await Promise.all(batch.map(async (symbol) => {
      try {
        // Yahoo uses a dash where Finnhub uses a dot for share classes.
        const yahooSymbol = symbol.replace('.', '-');
        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=1d&interval=1d`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UnifiedMarket/1.0)' } },
        );
        if (!response.ok) return;

        const meta = (await response.json())?.chart?.result?.[0]?.meta;
        const price = Number(meta?.regularMarketPrice);
        const previous = Number(meta?.chartPreviousClose ?? meta?.previousClose);
        if (Number.isFinite(price) && Number.isFinite(previous) && previous > 0) {
          returns.set(symbol, (price - previous) / previous);
        }
      } catch (error) {
        console.error(`yahoo ${symbol}:`, (error as Error).message);
      }
    }));
  }

  return returns;
}

/**
 * The composite score the page advertises.
 *
 * There was none. rank_score was a fossil from some earlier process that
 * nothing has written since December: seven symbols carried a value near 2 and
 * every other row sat at exactly 1.0000, so ordering by it put the list in
 * effectively arbitrary order — Abbott first, Nike second, and Apple, the
 * largest company on the list by a factor of twenty, nowhere in the top twenty.
 *
 * Size is most of it, because that is what a "top" list means, but a large
 * company having a quiet day should rank below a slightly smaller one that is
 * actually moving. Size uses a log scale: the gap from $50B to $500B matters
 * far more than the gap from $4T to $4.5T.
 */
function scoreStocks(rows: StockRow[]): Array<StockRow & { rank_score: number | null }> {
  const logCaps = rows
    .map((r) => (r.market_cap && r.market_cap > 0 ? Math.log10(r.market_cap) : null))
    .filter((v): v is number => v !== null);

  const minLog = logCaps.length ? Math.min(...logCaps) : 0;
  const maxLog = logCaps.length ? Math.max(...logCaps) : 0;
  const span = maxLog - minLog;

  return rows.map((row) => {
    if (!row.market_cap || row.market_cap <= 0) {
      // No size, no score — better a blank than a number that means nothing.
      return { ...row, rank_score: null };
    }

    const size = span > 0 ? (Math.log10(row.market_cap) - minLog) / span : 1;
    const move = Math.min(Math.abs(row.last_return_1d ?? 0) / FULL_MOVE, 1);
    const score = SIZE_WEIGHT * size + (1 - SIZE_WEIGHT) * move;

    // Presented out of ten, which reads better than a bare fraction.
    return { ...row, rank_score: Number((score * 10).toFixed(2)) };
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // These endpoints write shared market data and spend provider quota, and
  // previously accepted any caller. Restricted to the scheduler.
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(
      JSON.stringify({ error: 'unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    console.log('Starting top 100 update...');

    // Caps come from the table; update-market-caps keeps them fresh.
    // exchange is fetched in the same pass because it is NOT NULL and an upsert
    // that inserts a symbol the universe does not yet carry has to supply one —
    // and keeping the recorded MIC code beats overwriting it with a guess.
    const { data: existingRows, error: readError } = await supabaseClient
      .from('stocks')
      .select('symbol, exchange, market_cap, market_cap_updated_at')
      .in('symbol', TOP_100_SYMBOLS);

    if (readError) throw readError;

    const exchanges = new Map<string, string>();
    const caps = new Map<string, number>();
    const capStamps = new Map<string, string | null>();
    for (const row of existingRows ?? []) {
      const r = row as { symbol: string; exchange: string; market_cap: number | null; market_cap_updated_at: string | null };
      exchanges.set(r.symbol, r.exchange);
      if (r.market_cap && r.market_cap > 0) caps.set(r.symbol, Number(r.market_cap));
      capStamps.set(r.symbol, r.market_cap_updated_at);
    }

    const returns = await fetchDailyReturns(TOP_100_SYMBOLS);

    const rows: StockRow[] = TOP_100_SYMBOLS.map((symbol) => ({
      symbol,
      name: COMPANY_NAMES[symbol] || symbol,
      market_cap: caps.get(symbol) ?? null,
      last_return_1d: returns.get(symbol) ?? null,
    }));

    console.log(`${caps.size} caps on file, ${returns.size} returns fetched, of ${TOP_100_SYMBOLS.length}`);

    const scored = scoreStocks(rows);
    const now = new Date().toISOString();

    // Clear the flag only after the fetch succeeded. Clearing first meant a
    // provider outage emptied the list before there was anything to put back.
    await supabaseClient
      .from('stocks')
      .update({ is_top_100: false })
      .eq('is_top_100', true);

    // symbol is unique, so this is one round trip instead of the two hundred
    // the select-then-update loop was making.
    const { error: upsertError } = await supabaseClient
      .from('stocks')
      .upsert(
        scored.map((stock) => ({
          symbol: stock.symbol,
          name: stock.name,
          exchange: exchanges.get(stock.symbol) ?? 'US',
          market_cap: stock.market_cap,
          // Carried through, not stamped with now: this job read the cap from
          // the table rather than fetching it, and claiming it is fresh would
          // stop update-market-caps ever refreshing it.
          market_cap_updated_at: capStamps.get(stock.symbol) ?? null,
          last_return_1d: stock.last_return_1d,
          rank_score: stock.rank_score,
          is_top_100: true,
          last_ranked_at: now,
          updated_at: now,
        })),
        { onConflict: 'symbol' },
      );

    if (upsertError) throw upsertError;

    const { data: topStocks } = await supabaseClient
      .from('stocks')
      .select('symbol, name, market_cap, last_return_1d, rank_score')
      .eq('is_top_100', true)
      .order('rank_score', { ascending: false, nullsFirst: false })
      .limit(10);

    console.log('Top 10 by score:', topStocks?.map((s) => `${s.symbol}: ${s.rank_score}`).join(', '));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Ranked ${scored.filter((s) => s.rank_score !== null).length} of ${TOP_100_SYMBOLS.length} stocks`,
        top_stocks: topStocks?.slice(0, 5).map(s => ({
          symbol: s.symbol,
          name: s.name,
          market_cap: s.market_cap,
          change: s.last_return_1d
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Top 100 update error:', error);
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