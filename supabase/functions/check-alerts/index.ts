import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

interface Alert {
  id: string;
  symbol: string;
  alert_type: string;
  target_price: number | null;
  user_id: string;
  is_active: boolean;
  message: string | null;
}

interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
}

async function fetchPrices(symbols: string[], apiKey: string): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>();
  const batchSize = 8;
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const symbolsParam = batch.join(',');
    
    try {
      const response = await fetch(
        `https://api.twelvedata.com/quote?symbol=${symbolsParam}&apikey=${apiKey}`,
        { headers: { 'User-Agent': 'UnifiedMarket/1.0' } }
      );
      
      if (!response.ok) {
        console.error(`API error: ${response.status}`);
        continue;
      }
      
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
      
      // Rate limit protection
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`Fetch error for batch:`, error);
    }
  }
  
  return results;
}

function checkAlertCondition(alert: Alert, priceData: PriceData): boolean {
  const { alert_type, target_price } = alert;
  const { price, changePercent, volume, avgVolume } = priceData;
  
  if (!target_price && ['price_above', 'price_below', 'percent_up', 'percent_down', 'volume_spike'].includes(alert_type)) {
    return false;
  }
  
  switch (alert_type) {
    case 'price_above':
      return price >= target_price!;
    case 'price_below':
      return price <= target_price!;
    case 'percent_up':
      return changePercent >= target_price!;
    case 'percent_down':
      return changePercent <= -target_price!;
    case 'volume_spike':
      if (!avgVolume || avgVolume === 0) return false;
      const volumeRatio = volume / avgVolume;
      return volumeRatio >= target_price!;
    default:
      return false;
  }
}

function formatAlertMessage(alert: Alert, priceData: PriceData): string {
  const { symbol, alert_type, target_price, message } = alert;
  const { price, changePercent, volume, avgVolume } = priceData;
  
  if (message) return message;
  
  switch (alert_type) {
    case 'price_above':
      return `${symbol} is now at $${price.toFixed(2)} (above $${target_price})`;
    case 'price_below':
      return `${symbol} is now at $${price.toFixed(2)} (below $${target_price})`;
    case 'percent_up':
      return `${symbol} is up ${changePercent.toFixed(2)}% today`;
    case 'percent_down':
      return `${symbol} is down ${Math.abs(changePercent).toFixed(2)}% today`;
    case 'volume_spike':
      const ratio = avgVolume > 0 ? (volume / avgVolume).toFixed(1) : '?';
      return `${symbol} volume is ${ratio}x above average`;
    default:
      return `Alert triggered for ${symbol}`;
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const twelveDataKey = Deno.env.get('TWELVE_DATA_API_KEY');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token for RLS
    const supabase = createClient(supabaseUrl, supabaseKey);
    
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

    console.log(`Checking alerts for user: ${user.id}`);

    // Fetch user's active alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('watchlist_alerts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .is('triggered_at', null);

    if (alertsError) {
      throw alertsError;
    }

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ triggered: [], message: 'No active alerts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique symbols
    const symbols = [...new Set(alerts.map((a: Alert) => a.symbol))];
    console.log(`Checking ${alerts.length} alerts for symbols: ${symbols.join(', ')}`);

    if (!twelveDataKey) {
      return new Response(
        JSON.stringify({ triggered: [], message: 'API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch current prices
    const prices = await fetchPrices(symbols, twelveDataKey);
    console.log(`Fetched prices for ${prices.size} symbols`);

    // Check each alert
    const triggeredAlerts: Array<{ id: string; symbol: string; message: string; alert_type: string }> = [];
    
    for (const alert of alerts as Alert[]) {
      const priceData = prices.get(alert.symbol);
      if (!priceData) {
        console.log(`No price data for ${alert.symbol}`);
        continue;
      }

      const isTriggered = checkAlertCondition(alert, priceData);
      
      if (isTriggered) {
        console.log(`Alert triggered: ${alert.id} (${alert.symbol} - ${alert.alert_type})`);
        
        // Mark alert as triggered
        await supabase
          .from('watchlist_alerts')
          .update({ triggered_at: new Date().toISOString() })
          .eq('id', alert.id);
        
        triggeredAlerts.push({
          id: alert.id,
          symbol: alert.symbol,
          message: formatAlertMessage(alert, priceData),
          alert_type: alert.alert_type
        });
      }
    }

    console.log(`${triggeredAlerts.length} alerts triggered`);

    return new Response(
      JSON.stringify({ 
        triggered: triggeredAlerts,
        checked: alerts.length,
        message: triggeredAlerts.length > 0 
          ? `${triggeredAlerts.length} alert(s) triggered` 
          : 'No alerts triggered'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking alerts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
