import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Stock price data structure
 */
export interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  isFallback?: boolean;
}

/**
 * Global price cache to share across components
 * Prevents duplicate API calls for the same symbols
 */
const priceCache = new Map<string, { data: StockPrice; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache for real-time feel

/**
 * Pending requests tracker to prevent duplicate in-flight requests
 */
const pendingRequests = new Map<string, Promise<StockPrice | null>>();

/**
 * Get cached price if still valid
 */
function getCachedPrice(symbol: string): StockPrice | null {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

/**
 * Store price in cache
 */
function setCachedPrice(symbol: string, data: StockPrice): void {
  priceCache.set(symbol, { data, timestamp: Date.now() });
}

/**
 * Fetch prices for multiple symbols efficiently
 * Only fetches symbols not already cached
 */
async function fetchPrices(symbols: string[]): Promise<Map<string, StockPrice>> {
  const results = new Map<string, StockPrice>();
  const symbolsToFetch: string[] = [];

  // Check cache first
  for (const symbol of symbols) {
    const cached = getCachedPrice(symbol);
    if (cached) {
      results.set(symbol, cached);
    } else {
      symbolsToFetch.push(symbol);
    }
  }

  // If all symbols were cached, return immediately
  if (symbolsToFetch.length === 0) {
    console.log(`[useStockPrices] All ${symbols.length} symbols served from cache`);
    return results;
  }

  console.log(`[useStockPrices] Fetching ${symbolsToFetch.length} symbols (${symbols.length - symbolsToFetch.length} cached)`);

  try {
    const { data, error } = await supabase.functions.invoke('get-stock-prices', {
      body: { symbols: symbolsToFetch },
    });

    if (error) {
      console.error('[useStockPrices] Error fetching prices:', error);
      return results;
    }

    if (data && Array.isArray(data)) {
      for (const priceData of data) {
        const stockPrice: StockPrice = {
          symbol: priceData.symbol,
          price: priceData.price,
          change: priceData.change,
          changePercent: priceData.changePercent,
          high: priceData.high,
          low: priceData.low,
          open: priceData.open,
          previousClose: priceData.previousClose,
          isFallback: priceData.isFallback,
        };
        setCachedPrice(priceData.symbol, stockPrice);
        results.set(priceData.symbol, stockPrice);
      }
    }
  } catch (err) {
    console.error('[useStockPrices] Fetch error:', err);
  }

  return results;
}

/**
 * Hook to fetch stock prices for a list of symbols
 * Automatically caches results and prevents duplicate requests
 */
export function useStockPrices(symbols: string[]) {
  const [prices, setPrices] = useState<Map<string, StockPrice>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const symbolsRef = useRef<string[]>([]);

  const refresh = useCallback(async () => {
    if (symbols.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const priceMap = await fetchPrices(symbols);
      setPrices(priceMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
    } finally {
      setLoading(false);
    }
  }, [symbols.join(',')]);

  useEffect(() => {
    // Only refetch if symbols changed
    const symbolsKey = symbols.sort().join(',');
    const prevSymbolsKey = symbolsRef.current.sort().join(',');
    
    if (symbolsKey !== prevSymbolsKey) {
      symbolsRef.current = [...symbols];
      refresh();
    }
  }, [symbols, refresh]);

  // Initial fetch
  useEffect(() => {
    if (symbols.length > 0 && prices.size === 0) {
      refresh();
    }
  }, []);

  return { prices, loading, error, refresh };
}

/**
 * Hook to get a single stock price
 */
export function useStockPrice(symbol: string | null) {
  const symbols = symbol ? [symbol] : [];
  const { prices, loading, error, refresh } = useStockPrices(symbols);
  
  return {
    price: symbol ? prices.get(symbol) || null : null,
    loading,
    error,
    refresh,
  };
}

/**
 * Utility to clear the price cache (useful for forcing refresh)
 */
export function clearPriceCache(): void {
  priceCache.clear();
}
