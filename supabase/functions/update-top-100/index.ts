import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// Real top 100 US stocks by market cap (major companies)
const TOP_100_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'UNH', 'XOM',
  'JNJ', 'JPM', 'V', 'PG', 'MA', 'HD', 'CVX', 'MRK', 'ABBV', 'LLY',
  'PEP', 'KO', 'COST', 'AVGO', 'TMO', 'MCD', 'WMT', 'CSCO', 'ACN', 'ABT',
  'CRM', 'DHR', 'BAC', 'ADBE', 'NKE', 'DIS', 'NFLX', 'CMCSA', 'VZ', 'INTC',
  'PFE', 'TXN', 'PM', 'WFC', 'NEE', 'RTX', 'UPS', 'HON', 'T', 'QCOM',
  'ORCL', 'IBM', 'AMD', 'LOW', 'BMY', 'SPGI', 'UNP', 'CAT', 'GS', 'MS',
  'SBUX', 'BLK', 'DE', 'ELV', 'AMAT', 'ISRG', 'INTU', 'GILD', 'AXP', 'LMT',
  'MDLZ', 'ADI', 'ADP', 'CVS', 'SYK', 'TJX', 'BKNG', 'MMC', 'VRTX', 'REGN',
  'PLD', 'TMUS', 'AMT', 'ZTS', 'SCHW', 'C', 'MO', 'CB', 'SO', 'DUK',
  'CI', 'BDX', 'EOG', 'SLB', 'PNC', 'ICE', 'CL', 'EQIX', 'USB', 'MMM'
];

// Company names mapping
const COMPANY_NAMES: Record<string, string> = {
  'AAPL': 'Apple Inc.',
  'MSFT': 'Microsoft Corporation',
  'GOOGL': 'Alphabet Inc.',
  'AMZN': 'Amazon.com Inc.',
  'NVDA': 'NVIDIA Corporation',
  'META': 'Meta Platforms Inc.',
  'TSLA': 'Tesla Inc.',
  'BRK.B': 'Berkshire Hathaway Inc.',
  'UNH': 'UnitedHealth Group Inc.',
  'XOM': 'Exxon Mobil Corporation',
  'JNJ': 'Johnson & Johnson',
  'JPM': 'JPMorgan Chase & Co.',
  'V': 'Visa Inc.',
  'PG': 'Procter & Gamble Co.',
  'MA': 'Mastercard Inc.',
  'HD': 'The Home Depot Inc.',
  'CVX': 'Chevron Corporation',
  'MRK': 'Merck & Co. Inc.',
  'ABBV': 'AbbVie Inc.',
  'LLY': 'Eli Lilly and Company',
  'PEP': 'PepsiCo Inc.',
  'KO': 'The Coca-Cola Company',
  'COST': 'Costco Wholesale Corporation',
  'AVGO': 'Broadcom Inc.',
  'TMO': 'Thermo Fisher Scientific Inc.',
  'MCD': "McDonald's Corporation",
  'WMT': 'Walmart Inc.',
  'CSCO': 'Cisco Systems Inc.',
  'ACN': 'Accenture plc',
  'ABT': 'Abbott Laboratories',
  'CRM': 'Salesforce Inc.',
  'DHR': 'Danaher Corporation',
  'BAC': 'Bank of America Corporation',
  'ADBE': 'Adobe Inc.',
  'NKE': 'NIKE Inc.',
  'DIS': 'The Walt Disney Company',
  'NFLX': 'Netflix Inc.',
  'CMCSA': 'Comcast Corporation',
  'VZ': 'Verizon Communications Inc.',
  'INTC': 'Intel Corporation',
  'PFE': 'Pfizer Inc.',
  'TXN': 'Texas Instruments Inc.',
  'PM': 'Philip Morris International Inc.',
  'WFC': 'Wells Fargo & Company',
  'NEE': 'NextEra Energy Inc.',
  'RTX': 'RTX Corporation',
  'UPS': 'United Parcel Service Inc.',
  'HON': 'Honeywell International Inc.',
  'T': 'AT&T Inc.',
  'QCOM': 'QUALCOMM Inc.',
  'ORCL': 'Oracle Corporation',
  'IBM': 'International Business Machines',
  'AMD': 'Advanced Micro Devices Inc.',
  'LOW': "Lowe's Companies Inc.",
  'BMY': 'Bristol-Myers Squibb Company',
  'SPGI': 'S&P Global Inc.',
  'UNP': 'Union Pacific Corporation',
  'CAT': 'Caterpillar Inc.',
  'GS': 'Goldman Sachs Group Inc.',
  'MS': 'Morgan Stanley',
  'SBUX': 'Starbucks Corporation',
  'BLK': 'BlackRock Inc.',
  'DE': 'Deere & Company',
  'ELV': 'Elevance Health Inc.',
  'AMAT': 'Applied Materials Inc.',
  'ISRG': 'Intuitive Surgical Inc.',
  'INTU': 'Intuit Inc.',
  'GILD': 'Gilead Sciences Inc.',
  'AXP': 'American Express Company',
  'LMT': 'Lockheed Martin Corporation',
  'MDLZ': 'Mondelez International Inc.',
  'ADI': 'Analog Devices Inc.',
  'ADP': 'Automatic Data Processing Inc.',
  'CVS': 'CVS Health Corporation',
  'SYK': 'Stryker Corporation',
  'TJX': 'The TJX Companies Inc.',
  'BKNG': 'Booking Holdings Inc.',
  'MMC': 'Marsh & McLennan Companies',
  'VRTX': 'Vertex Pharmaceuticals Inc.',
  'REGN': 'Regeneron Pharmaceuticals Inc.',
  'PLD': 'Prologis Inc.',
  'TMUS': 'T-Mobile US Inc.',
  'AMT': 'American Tower Corporation',
  'ZTS': 'Zoetis Inc.',
  'SCHW': 'Charles Schwab Corporation',
  'C': 'Citigroup Inc.',
  'MO': 'Altria Group Inc.',
  'CB': 'Chubb Limited',
  'SO': 'Southern Company',
  'DUK': 'Duke Energy Corporation',
  'CI': 'The Cigna Group',
  'BDX': 'Becton Dickinson and Company',
  'EOG': 'EOG Resources Inc.',
  'SLB': 'Schlumberger Limited',
  'PNC': 'PNC Financial Services Group',
  'ICE': 'Intercontinental Exchange Inc.',
  'CL': 'Colgate-Palmolive Company',
  'EQIX': 'Equinix Inc.',
  'USB': 'U.S. Bancorp',
  'MMM': '3M Company'
};

interface StockQuote {
  c: number; // Current price
  d: number; // Change
  dp: number; // Percent change
  h: number; // High
  l: number; // Low
  o: number; // Open
  pc: number; // Previous close
}

interface CompanyProfile {
  marketCapitalization: number;
  name: string;
}

async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status === 429 && i < retries) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      return response;
    } catch (error) {
      if (i === retries) throw error;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Max retries exceeded');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const finnhubApiKey = Deno.env.get('FINNHUB_API_KEY');
    if (!finnhubApiKey) {
      throw new Error('FINNHUB_API_KEY not configured');
    }

    console.log('Starting top 100 update with real market data...');

    // First, clear old is_top_100 flags
    await supabaseClient
      .from('stocks')
      .update({ is_top_100: false })
      .neq('id', 0);

    const stockUpdates: Array<{
      symbol: string;
      name: string;
      market_cap: number | null;
      last_return_1d: number | null;
    }> = [];

    // Fetch data for each stock (batch in groups to avoid rate limits)
    const batchSize = 10;
    for (let i = 0; i < TOP_100_SYMBOLS.length; i += batchSize) {
      const batch = TOP_100_SYMBOLS.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (symbol) => {
        try {
          // Fetch quote for price change
          const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubApiKey}`;
          const quoteResponse = await fetchWithRetry(quoteUrl);
          
          if (!quoteResponse.ok) {
            console.log(`Quote failed for ${symbol}: ${quoteResponse.status}`);
            return null;
          }
          
          const quote: StockQuote = await quoteResponse.json();
          
          // Fetch company profile for market cap
          const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${finnhubApiKey}`;
          const profileResponse = await fetchWithRetry(profileUrl);
          
          let marketCap: number | null = null;
          if (profileResponse.ok) {
            const profile: CompanyProfile = await profileResponse.json();
            // Finnhub returns market cap in millions
            marketCap = profile.marketCapitalization ? profile.marketCapitalization * 1000000 : null;
          }
          
          // Calculate 1-day return as decimal (e.g., 0.02 = 2%)
          const lastReturn = quote.pc > 0 ? (quote.c - quote.pc) / quote.pc : null;
          
          return {
            symbol,
            name: COMPANY_NAMES[symbol] || symbol,
            market_cap: marketCap,
            last_return_1d: lastReturn
          };
        } catch (error) {
          console.error(`Error fetching ${symbol}:`, error);
          return {
            symbol,
            name: COMPANY_NAMES[symbol] || symbol,
            market_cap: null,
            last_return_1d: null
          };
        }
      });

      const results = await Promise.all(batchPromises);
      stockUpdates.push(...results.filter(r => r !== null));
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < TOP_100_SYMBOLS.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`Fetched data for ${stockUpdates.length} stocks`);

    // Upsert all stocks
    for (const stock of stockUpdates) {
      // Check if stock exists
      const { data: existing } = await supabaseClient
        .from('stocks')
        .select('id')
        .eq('symbol', stock.symbol)
        .single();

      if (existing) {
        // Update existing
        await supabaseClient
          .from('stocks')
          .update({
            name: stock.name,
            market_cap: stock.market_cap,
            last_return_1d: stock.last_return_1d,
            is_top_100: true,
            last_ranked_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('symbol', stock.symbol);
      } else {
        // Insert new
        await supabaseClient
          .from('stocks')
          .insert({
            symbol: stock.symbol,
            name: stock.name,
            exchange: 'NASDAQ',
            market_cap: stock.market_cap,
            last_return_1d: stock.last_return_1d,
            is_top_100: true,
            last_ranked_at: new Date().toISOString()
          });
      }
    }

    // Get the top stocks by market cap for logging
    const { data: topStocks } = await supabaseClient
      .from('stocks')
      .select('symbol, name, market_cap, last_return_1d')
      .eq('is_top_100', true)
      .order('market_cap', { ascending: false, nullsLast: true })
      .limit(10);

    console.log('Top 10 by market cap:', topStocks?.map(s => `${s.symbol}: $${(s.market_cap / 1e12).toFixed(2)}T`));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully updated ${stockUpdates.length} stocks with real market data`,
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