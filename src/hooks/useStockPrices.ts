import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PerformanceCache, RequestBatcher } from '@/lib/performanceCache';

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
 * Performance cache for stock prices
 * Shared across all components using this hook
 */
const priceCache = new PerformanceCache<StockPrice>({
  maxSize: 500,
  defaultTtlMs: 60 * 1000, // 1 minute cache for real-time feel
});

/**
 * Request batcher to combine multiple symbol requests
 * Reduces API calls by batching requests within 50ms window
 */
const priceBatcher = new RequestBatcher<string, StockPrice>(
  async (symbols: string[]) => {
    const uniqueSymbols = [...new Set(symbols)];
    console.log(`[RequestBatcher] Fetching ${uniqueSymbols.length} symbols in batch`);
    
    const { data, error } = await supabase.functions.invoke('get-stock-prices', {
      body: { symbols: uniqueSymbols },
    });
    
    const results = new Map<string, StockPrice>();
    
    if (error) {
      console.error('[RequestBatcher] Error fetching prices:', error);
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
        results.set(priceData.symbol, stockPrice);
      }
    }
    
    return results;
  },
  {
    maxBatchSize: 50,
    batchDelayMs: 50,
  }
);

/**
 * Pending requests tracker to prevent duplicate in-flight requests
 */
const pendingRequests = new Map<string, Promise<StockPrice | null>>();

/**
 * Fetch prices for multiple symbols efficiently
 * Uses batching and caching for optimal performance
 */
async function fetchPrices(symbols: string[]): Promise<Map<string, StockPrice>> {
  const results = new Map<string, StockPrice>();
  const symbolsToFetch: string[] = [];

  // Check cache first
  for (const symbol of symbols) {
    const cached = priceCache.get(symbol);
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

  // Use batching for efficient fetching
  const fetchPromises = symbolsToFetch.map(async (symbol) => {
    const result = await priceBatcher.add(symbol);
    if (result) {
      priceCache.set(symbol, result);
      results.set(symbol, result);
    }
  });

  await Promise.all(fetchPromises);
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
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (symbols.length === 0) {
      setLoading(false);
      return;
    }

    // Cancel any pending request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const priceMap = await fetchPrices(symbols);
      setPrices(priceMap);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Ignore aborted requests
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
    } finally {
      setLoading(false);
    }
  }, [symbols.join(',')]);

  useEffect(() => {
    // Only refetch if symbols changed
    const symbolsKey = [...symbols].sort().join(',');
    const prevSymbolsKey = [...symbolsRef.current].sort().join(',');
    
    if (symbolsKey !== prevSymbolsKey || (symbols.length > 0 && prices.size === 0)) {
      symbolsRef.current = [...symbols];
      refresh();
    }
    
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [symbols, refresh]);

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

/**
 * Get cache statistics for debugging
 */
export function getPriceCacheStats() {
  return priceCache.getStats();
}
