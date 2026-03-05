/**
 * Multi-API-key support: read comma-separated keys from env and round-robin.
 * Set e.g. FINNHUB_API_KEYS=key1,key2,key3 in Supabase secrets (or keep FINNHUB_API_KEY for a single key).
 */

function parseKeys(envKey: string, envKeysMultiple: string): string[] {
  const multi = Deno.env.get(envKeysMultiple);
  if (multi && multi.trim()) {
    const keys = multi.split(",").map((k) => k.trim()).filter(Boolean);
    if (keys.length) return keys;
  }
  const single = Deno.env.get(envKey);
  if (single && single.trim()) return [single.trim()];
  return [];
}

let finnhubCounter = 0;
let alphaVantageCounter = 0;
let twelveDataCounter = 0;

export function getFinnhubKeys(): string[] {
  return parseKeys("FINNHUB_API_KEY", "FINNHUB_API_KEYS");
}

export function getAlphaVantageKeys(): string[] {
  return parseKeys("ALPHA_VANTAGE_API_KEY", "ALPHA_VANTAGE_API_KEYS");
}

export function getTwelveDataKeys(): string[] {
  return parseKeys("TWELVE_DATA_API_KEY", "TWELVE_DATA_API_KEYS");
}

/** Round-robin next key from list (use for each request/batch to spread rate limits). */
export function nextFinnhubKey(): string | null {
  const keys = getFinnhubKeys();
  if (!keys.length) return null;
  return keys[finnhubCounter++ % keys.length];
}

export function nextAlphaVantageKey(): string | null {
  const keys = getAlphaVantageKeys();
  if (!keys.length) return null;
  return keys[alphaVantageCounter++ % keys.length];
}

export function nextTwelveDataKey(): string | null {
  const keys = getTwelveDataKeys();
  if (!keys.length) return null;
  return keys[twelveDataCounter++ % keys.length];
}
