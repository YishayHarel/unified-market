import { getFinnhubKeys, nextFinnhubKey } from "./finnhubKeys.js";

const CACHE_TTL_MS = 30 * 1000;
const MAX_CACHE_SIZE = 1000;
const CACHE_CLEANUP_COUNT = 200;
const FINNHUB_TIMEOUT_MS = 8000;
const FINNHUB_BATCH_SIZE = 10;
const BATCH_DELAY_MS = 100;

const priceCache = new Map();

function getCached(symbol) {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }
  priceCache.delete(symbol);
  return null;
}

function setCache(symbol, data) {
  if (priceCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(priceCache.entries()).sort(
      (a, b) => a[1].expiry - b[1].expiry,
    );
    for (let i = 0; i < Math.min(CACHE_CLEANUP_COUNT, entries.length); i += 1) {
      priceCache.delete(entries[i][0]);
    }
  }

  priceCache.set(symbol, {
    data,
    expiry: Date.now() + CACHE_TTL_MS,
  });
}

async function fetchFinnhubPrice(symbol, apiKey) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FINNHUB_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`,
      {
        signal: controller.signal,
        headers: { "User-Agent": "UnifiedMarket/1.0" },
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!(data && data.c && data.c > 0)) {
      return null;
    }

    return {
      symbol,
      price: data.c,
      change: data.d || 0,
      changePercent: data.dp || 0,
      high: data.h || data.c,
      low: data.l || data.c,
      open: data.o || data.c,
      previousClose: data.pc || data.c,
      isFallback: false,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchPricesWithFinnhub(symbols) {
  const results = new Map();

  for (let i = 0; i < symbols.length; i += FINNHUB_BATCH_SIZE) {
    const batch = symbols.slice(i, i + FINNHUB_BATCH_SIZE);
    const apiKey = nextFinnhubKey();
    if (!apiKey) {
      throw new Error("FINNHUB_API_KEY or FINNHUB_API_KEYS is required");
    }

    const batchResults = await Promise.all(
      batch.map(async (symbol) => {
        const priceData = await fetchFinnhubPrice(symbol, apiKey);
        if (priceData) {
          setCache(symbol, priceData);
          results.set(symbol, priceData);
        }
      }),
    );

    void batchResults;

    if (i + FINNHUB_BATCH_SIZE < symbols.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return results;
}

export async function getStockPrices(symbols) {
  const normalizedSymbols = symbols
    .filter((symbol) => typeof symbol === "string")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  const uniqueSymbols = Array.from(new Set(normalizedSymbols));
  const cachedResults = [];
  const uncachedSymbols = [];

  for (const symbol of uniqueSymbols) {
    const cached = getCached(symbol);
    if (cached) {
      cachedResults.push(cached);
    } else {
      uncachedSymbols.push(symbol);
    }
  }

  const fetchedMap =
    uncachedSymbols.length > 0
      ? await fetchPricesWithFinnhub(uncachedSymbols)
      : new Map();

  const merged = uniqueSymbols.map((symbol) => {
    const cached = cachedResults.find((entry) => entry.symbol === symbol);
    if (cached) {
      return cached;
    }

    const fetched = fetchedMap.get(symbol);
    if (fetched) {
      return fetched;
    }

    return {
      symbol,
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      isFallback: true,
      error: "No data available",
    };
  });

  return merged;
}
