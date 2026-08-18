/**
 * RSS aggregation for market news (Deno / Edge Functions).
 *
 * Deliberately a port of server/src/services/rssNews.js rather than an import:
 * Edge Functions bundle only from supabase/functions/, so the Express copy is
 * out of reach. Keep the two in step when changing feeds or filters.
 *
 * Finnhub's `category=general` is a single low-signal stream that mixes in photo
 * galleries and offers no ranking. Publisher RSS is free, keyless, updates
 * within minutes, and gives several independent desks to merge.
 */

export interface Article {
  title: string;
  description: string;
  source: { name: string };
  publishedAt: string;
  url: string;
  urlToImage: string | null;
}

export interface Feed {
  name: string;
  url: string;
}

/**
 * Feeds used for the general market view.
 *
 * Nasdaq's rssoutbound feed is deliberately absent: it serves fine to curl but
 * hangs for fetch() regardless of User-Agent, so it only ever contributed a
 * timeout.
 */
export const GENERAL_FEEDS: Feed[] = [
  { name: "CNBC Markets", url: "https://www.cnbc.com/id/10000664/device/rss/rss.html" },
  { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { name: "MarketWatch", url: "http://feeds.marketwatch.com/marketwatch/topstories/" },
  { name: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex" },
  { name: "Investing.com", url: "https://www.investing.com/rss/news_25.rss" },
  { name: "Seeking Alpha", url: "https://seekingalpha.com/market_currents.xml" },
];

/** Per-symbol headlines. Yahoo keys this feed off the ticker itself. */
export function symbolFeedUrl(symbol: string): string {
  return `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
    symbol,
  )}&region=US&lang=en-US`;
}

const FEED_TIMEOUT_MS = 5000;
const USER_AGENT = "UnifiedMarket/1.0 (+https://unified-market.vercel.app)";

/**
 * Headlines that are technically "business news" but carry no market signal.
 * Kept deliberately narrow — an over-eager filter silently drops real stories,
 * which is worse than letting the occasional dud through.
 */
const NOISE_PATTERNS = [
  /pictures? of the day/i,
  /photos? of the (day|week)/i,
  /\bin photos\b/i,
  /horoscope/i,
  /\brecipe\b/i,
  /\bbest (credit cards?|savings accounts?|cd rates?|personal loans?|mortgage rates?)\b/i,
  /\bmy (husband|wife|parents?|mother|father|son|daughter|brother|sister|boyfriend|girlfriend)\b/i,
  /\bshould i (buy|sell|tell|keep)\b/i,
];

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

/** RSS routinely double-encodes; publishers mix numeric and named entities. */
function decodeEntities(input: string): string {
  if (!input) return "";
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key)
        ? NAMED_ENTITIES[key]
        : match;
    });
}

function stripHtml(input: unknown): string {
  return decodeEntities(String(input ?? "").replace(/<[^>]*>/g, "")).trim();
}

function tagValue(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return "";
  return match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();
}

/** Publishers advertise images in several mutually incompatible ways. */
function extractImage(itemXml: string): string | null {
  const mediaContent = itemXml.match(/<media:(?:content|thumbnail)[^>]*url=["']([^"']+)["']/i);
  if (mediaContent) return decodeEntities(mediaContent[1]);

  const enclosure = itemXml.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i);
  if (enclosure) return decodeEntities(enclosure[1]);

  const inlineImg = itemXml.match(/<img[^>]*src=["']([^"']+)["']/i);
  if (inlineImg) return decodeEntities(inlineImg[1]);

  return null;
}

function parseFeed(xml: string, sourceName: string): Article[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];

  const parsed: Article[] = [];
  for (const item of items) {
    const title = stripHtml(tagValue(item, "title"));
    const link = stripHtml(tagValue(item, "link"));
    if (!title || !link) continue;

    const published = tagValue(item, "pubDate") || tagValue(item, "dc:date");
    const timestamp = published ? Date.parse(published) : NaN;
    const description =
      stripHtml(tagValue(item, "description")) || stripHtml(tagValue(item, "content:encoded"));

    parsed.push({
      title,
      description: description || title,
      source: { name: sourceName },
      // Undated items sort to "now" rather than 1970, which would bury them.
      publishedAt: new Date(Number.isNaN(timestamp) ? Date.now() : timestamp).toISOString(),
      url: link,
      urlToImage: extractImage(item),
    });
  }
  return parsed;
}

async function fetchFeed({ name, url }: Feed): Promise<Article[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    if (!response.ok) return [];
    return parseFeed(await response.text(), name);
  } catch {
    // One unavailable publisher must not take down the whole feed.
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/** Same story from two wires shares a title but not a URL — dedupe on both. */
function dedupe(articles: Article[]): Article[] {
  const seenTitles = new Set<string>();
  const seenUrls = new Set<string>();
  const out: Article[] = [];

  for (const article of articles) {
    const titleKey = normalizeTitle(article.title);
    const urlKey = article.url.split("?")[0];
    if (seenTitles.has(titleKey) || seenUrls.has(urlKey)) continue;
    seenTitles.add(titleKey);
    seenUrls.add(urlKey);
    out.push(article);
  }

  return out;
}

function isNoise(article: Article): boolean {
  return NOISE_PATTERNS.some((pattern) => pattern.test(article.title));
}

/**
 * Takes from each source in turn instead of sorting the merged list purely by
 * time. Publishers post at wildly different rates — sorting on recency alone
 * hands every slot to whoever publishes most often.
 *
 * Sources are ordered by their freshest headline, so the newest story still
 * leads and each desk stays represented further down.
 */
function interleaveBySource(articles: Article[], limit: number): Article[] {
  const bySource = new Map<string, Article[]>();
  for (const article of articles) {
    const list = bySource.get(article.source.name);
    if (list) list.push(article);
    else bySource.set(article.source.name, [article]);
  }

  const byRecency = (a: Article, b: Article) =>
    Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  const lists = [...bySource.values()];
  for (const list of lists) list.sort(byRecency);
  lists.sort((a, b) => byRecency(a[0], b[0]));

  const out: Article[] = [];
  for (let round = 0; out.length < limit; round++) {
    let addedThisRound = false;
    for (const list of lists) {
      if (round >= list.length) continue;
      out.push(list[round]);
      addedThisRound = true;
      if (out.length >= limit) break;
    }
    if (!addedThisRound) break;
  }

  return out;
}

/**
 * Cleans and balances an already-fetched set of articles. Exposed so callers
 * that mix RSS with another provider (Finnhub company-news) get identical
 * dedupe, filtering, and source balancing.
 */
export function mergeArticles(articles: Article[], limit: number): Article[] {
  return interleaveBySource(dedupe(articles.filter((a) => !isNoise(a))), limit);
}

/**
 * Merges every feed, drops duplicates and noise, and returns a source-balanced
 * set ordered newest first. Feeds are fetched concurrently and a failure in one
 * is swallowed so the rest still serve.
 */
export async function aggregateFeeds(feeds: Feed[], limit: number): Promise<Article[]> {
  const results = await Promise.all(feeds.map(fetchFeed));
  return mergeArticles(results.flat(), limit);
}
