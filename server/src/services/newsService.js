import { getFinnhubKeys, nextFinnhubKey } from "./finnhubKeys.js";

const FINNHUB_TIMEOUT_MS = 8000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function sanitizeSymbol(symbol) {
  if (!symbol) return undefined;
  return String(symbol).replace(/[^A-Za-z0-9.]/g, "").toUpperCase().slice(0, 10);
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

export async function getNews({ symbol, pageSize }) {
  const finnhubKey = nextFinnhubKey();
  if (!finnhubKey || !getFinnhubKeys().length) {
    throw new Error("FINNHUB_API_KEY or FINNHUB_API_KEYS not found");
  }

  const sanitizedSymbol = sanitizeSymbol(symbol);
  const validPageSize = Math.min(Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  let url;
  if (sanitizedSymbol) {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fromDate = weekAgo.toISOString().split("T")[0];
    const toDate = today.toISOString().split("T")[0];
    url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(sanitizedSymbol)}&from=${fromDate}&to=${toDate}&token=${finnhubKey}`;
  } else {
    url = `https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FINNHUB_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "UnifiedMarket/1.0" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Finnhub error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const baseArticles = (Array.isArray(data) ? data : [])
      .filter((article) => article?.headline && article?.url)
      .slice(0, validPageSize)
      .map((article) => ({
        title: article.headline,
        description: article.summary || article.headline,
        source: { name: article.source || "Finnhub" },
        publishedAt: new Date(article.datetime * 1000).toISOString(),
        url: article.url,
        urlToImage: article.image || null,
      }));

    const seen = new Set();
    const deduplicatedArticles = baseArticles.filter((article) => {
      const key = normalizeTitle(article.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { articles: deduplicatedArticles, status: "ok" };
  } finally {
    clearTimeout(timeoutId);
  }
}
