import { getFinnhubKeys, nextFinnhubKey } from "./finnhubKeys.js";
import {
  aggregateFeeds,
  mergeArticles,
  GENERAL_FEEDS,
  symbolFeedUrl,
} from "./rssNews.js";

const FINNHUB_TIMEOUT_MS = 8000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function sanitizeSymbol(symbol) {
  if (!symbol) return undefined;
  return String(symbol).replace(/[^A-Za-z0-9.]/g, "").toUpperCase().slice(0, 10);
}

/** Finnhub's company-news endpoint: the best per-ticker source we have. */
async function fetchFinnhubCompanyNews(symbol) {
  const finnhubKey = nextFinnhubKey();
  if (!finnhubKey || !getFinnhubKeys().length) return [];

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fromDate = weekAgo.toISOString().split("T")[0];
  const toDate = today.toISOString().split("T")[0];
  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(
    symbol
  )}&from=${fromDate}&to=${toDate}&token=${finnhubKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FINNHUB_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "UnifiedMarket/1.0" },
    });
    if (!response.ok) return [];

    const data = await response.json();
    return (Array.isArray(data) ? data : [])
      .filter((article) => article?.headline && article?.url)
      .map((article) => ({
        title: article.headline,
        description: article.summary || article.headline,
        source: { name: article.source || "Finnhub" },
        publishedAt: new Date(article.datetime * 1000).toISOString(),
        url: article.url,
        urlToImage: article.image || null,
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Market news.
 *
 * General headlines come from several publisher RSS feeds rather than Finnhub's
 * `category=general`, which was a single low-signal stream. Per-symbol requests
 * combine Finnhub's company-news with Yahoo's ticker feed for better coverage.
 *
 * No source is required: if every upstream fails the caller gets an empty list
 * instead of an exception, and the route can still respond.
 */
export async function getNews({ symbol, pageSize }) {
  const sanitizedSymbol = sanitizeSymbol(symbol);
  const validPageSize = Math.min(
    Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );

  if (sanitizedSymbol) {
    const [finnhubArticles, yahooArticles] = await Promise.all([
      fetchFinnhubCompanyNews(sanitizedSymbol),
      aggregateFeeds(
        [{ name: "Yahoo Finance", url: symbolFeedUrl(sanitizedSymbol) }],
        validPageSize
      ),
    ]);

    const articles = mergeArticles(
      [...finnhubArticles, ...yahooArticles],
      validPageSize
    );

    return { articles, status: "ok" };
  }

  const articles = await aggregateFeeds(GENERAL_FEEDS, validPageSize);
  return { articles, status: "ok" };
}
