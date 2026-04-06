import { nextFinnhubKey, getFinnhubKeys } from "./finnhubKeys.js";

const fundamentalsCache = new Map();
const FUNDAMENTALS_TTL_MS = 10 * 60 * 1000;

function getCached(symbol) {
  const cached = fundamentalsCache.get(symbol);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }
  fundamentalsCache.delete(symbol);
  return null;
}

function setCached(symbol, data) {
  fundamentalsCache.set(symbol, { data, expiry: Date.now() + FUNDAMENTALS_TTL_MS });
}

export async function getStockFundamentals(symbol) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  if (!normalizedSymbol) {
    throw new Error("symbol is required");
  }

  const cached = getCached(normalizedSymbol);
  if (cached) return cached;

  const finnhubKey = nextFinnhubKey();
  if (!finnhubKey || !getFinnhubKeys().length) {
    throw new Error("FINNHUB_API_KEY or FINNHUB_API_KEYS not found");
  }

  const urls = [
    `https://finnhub.io/api/v1/stock/metric?symbol=${normalizedSymbol}&metric=all&token=${finnhubKey}`,
    `https://finnhub.io/api/v1/stock/profile2?symbol=${normalizedSymbol}&token=${finnhubKey}`,
    `https://finnhub.io/api/v1/stock/recommendation?symbol=${normalizedSymbol}&token=${finnhubKey}`,
    `https://finnhub.io/api/v1/stock/price-target?symbol=${normalizedSymbol}&token=${finnhubKey}`,
    `https://finnhub.io/api/v1/quote?symbol=${normalizedSymbol}&token=${finnhubKey}`,
  ];

  const [basicRes, profileRes, recRes, targetRes, quoteRes] = await Promise.all(urls.map((url) => fetch(url)));

  const basicData = basicRes.ok ? await basicRes.json() : {};
  const profileData = profileRes.ok ? await profileRes.json() : {};
  const recommendationData = recRes.ok ? await recRes.json() : [];
  const priceTargetData = targetRes.ok ? await targetRes.json() : null;
  const quoteData = quoteRes.ok ? await quoteRes.json() : null;

  const fundamentals = basicData?.metric || {};
  const profile = profileData || {};

  const result = {
    symbol: normalizedSymbol,
    marketCapitalization: profile.marketCapitalization || fundamentals.marketCapitalization || null,
    peRatio: fundamentals.peBasicExclExtraTTM || fundamentals.peTTM || null,
    dividendYield: fundamentals.dividendYieldIndicatedAnnual || fundamentals.dividendYield || null,
    week52High: fundamentals["52WeekHigh"] || null,
    week52Low: fundamentals["52WeekLow"] || null,
    beta: fundamentals.beta || null,
    eps: fundamentals.epsBasicExclExtraTTM || null,
    revenue: fundamentals.revenuesPerShareTTM || null,
    industry: profile.finnhubIndustry || null,
    sector: profile.gind || null,
    employeeCount: profile.employeeTotal || null,
    sharesOutstanding: profile.shareOutstanding || null,
    bookValue: fundamentals.bookValuePerShareAnnual || null,
    recommendationTrends: Array.isArray(recommendationData) ? recommendationData : [],
    priceTarget: priceTargetData,
    quote: quoteData,
  };

  setCached(normalizedSymbol, result);
  return result;
}
