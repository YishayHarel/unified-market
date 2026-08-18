/**
 * RSS aggregation for market news.
 *
 * Finnhub's `category=general` feed is a single low-signal stream — it mixes in
 * photo galleries and off-topic wire copy, and offers no way to rank or filter.
 * Publisher RSS is free, keyless, updates within minutes, and gives us several
 * independent editorial desks to merge.
 *
 * Everything here is plain fetch + string parsing so the same logic runs
 * unchanged on Node (Express) and Deno (Supabase Edge Functions).
 */

/**
 * Feeds used for the general market view.
 *
 * Chosen so every headline arrives with a real summary — a card showing its
 * own title twice looks broken. Publishers excluded after testing:
 *
 * - Seeking Alpha, Investing.com: no <description> in any of their feeds, and
 *   Seeking Alpha answers article requests with a bot captcha, so the summary
 *   cannot be recovered from the page either.
 * - Nasdaq: serves to curl but hangs for fetch() regardless of User-Agent.
 * - Business Insider, Google News: ship escaped CSS and bare anchor tags in
 *   <description> rather than prose.
 */
export const GENERAL_FEEDS = [
  { name: "CNBC Markets", url: "https://www.cnbc.com/id/10000664/device/rss/rss.html" },
  { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { name: "MarketWatch", url: "http://feeds.marketwatch.com/marketwatch/topstories/" },
  // Yahoo's general feeds (rssindex, topstories) ship zero <description>
  // elements; the per-ticker endpoint does, and ^GSPC scopes it to the S&P 500
  // for market-wide coverage.
  { name: "Yahoo Finance", url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US" },
  { name: "Motley Fool", url: "https://www.fool.com/feeds/index.aspx" },
  { name: "Fortune", url: "https://fortune.com/feed/fortune-feeds/?id=3230629" },
];

/** Per-symbol headlines. Yahoo keys this feed off the ticker itself. */
export function symbolFeedUrl(symbol) {
  return `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
    symbol
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
  // Photo galleries and lifestyle filler that ride along on business feeds.
  /pictures? of the day/i,
  /photos? of the (day|week)/i,
  /\bin photos\b/i,
  /horoscope/i,
  /\brecipe\b/i,
  // Personal-finance service journalism (MarketWatch's Moneyist column, Yahoo's
  // card/rate roundups). Real content, but no market signal.
  /\bbest (credit cards?|savings accounts?|cd rates?|personal loans?|mortgage rates?)\b/i,
  /\bmy (husband|wife|parents?|mother|father|son|daughter|brother|sister|boyfriend|girlfriend)\b/i,
  /\bshould i (buy|sell|tell|keep)\b/i,
];

const NAMED_ENTITIES = {
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
function decodeEntities(input) {
  if (!input) return "";
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key)
        ? NAMED_ENTITIES[key]
        : match;
    });
}

/**
 * Some feeds escape their markup (`&lt;a href=...&gt;`), so a single
 * strip-then-decode pass leaves raw HTML in the visible text. Decode first,
 * strip, then repeat once to catch markup that only appeared after decoding.
 */
function stripHtml(input) {
  let text = String(input ?? "");
  for (let pass = 0; pass < 2; pass++) {
    text = decodeEntities(text).replace(/<[^>]*>/g, "");
  }
  return text.replace(/\s+/g, " ").trim();
}

function tagValue(xml, tag) {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i")
  );
  if (!match) return "";
  return match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();
}

/** Publishers advertise images in several mutually incompatible ways. */
function extractImage(itemXml) {
  const mediaContent = itemXml.match(
    /<media:(?:content|thumbnail)[^>]*url=["']([^"']+)["']/i
  );
  if (mediaContent) return decodeEntities(mediaContent[1]);

  const enclosure = itemXml.match(
    /<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i
  );
  if (enclosure) return decodeEntities(enclosure[1]);

  const inlineImg = itemXml.match(/<img[^>]*src=["']([^"']+)["']/i);
  if (inlineImg) return decodeEntities(inlineImg[1]);

  return null;
}

function parseFeed(xml, sourceName) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];

  return items
    .map((item) => {
      const title = stripHtml(tagValue(item, "title"));
      const link = stripHtml(tagValue(item, "link"));
      if (!title || !link) return null;

      const published = tagValue(item, "pubDate") || tagValue(item, "dc:date");
      const timestamp = published ? Date.parse(published) : NaN;

      const description =
        stripHtml(tagValue(item, "description")) ||
        stripHtml(tagValue(item, "content:encoded"));

      return {
        title,
        description: description || title,
        source: { name: sourceName },
        // Undated items sort to "now" rather than 1970, which would bury them.
        publishedAt: new Date(
          Number.isNaN(timestamp) ? Date.now() : timestamp
        ).toISOString(),
        url: link,
        urlToImage: extractImage(item),
      };
    })
    .filter(Boolean);
}

async function fetchFeed({ name, url }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml, */*" },
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

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/** Same story from two wires shares a title but not a URL — dedupe on both. */
function dedupe(articles) {
  const seenTitles = new Set();
  const seenUrls = new Set();
  const out = [];

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

function isNoise(article) {
  return NOISE_PATTERNS.some((pattern) => pattern.test(article.title));
}

/**
 * Takes from each source in turn instead of sorting the merged list purely by
 * time. Publishers post at wildly different rates — sorting on recency alone
 * hands every slot to whoever publishes most often (Investing.com filled all
 * ten in testing while Yahoo's 50 items and CNBC's 30 never appeared).
 *
 * Sources are ordered by their freshest headline, so the newest story still
 * leads and each desk stays represented further down.
 */
function interleaveBySource(articles, limit) {
  const bySource = new Map();
  for (const article of articles) {
    const list = bySource.get(article.source.name);
    if (list) list.push(article);
    else bySource.set(article.source.name, [article]);
  }

  const byRecency = (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  const lists = [...bySource.values()];
  for (const list of lists) list.sort(byRecency);
  lists.sort((a, b) => byRecency(a[0], b[0]));

  const out = [];
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
 * Merges every feed, drops duplicates and noise, and returns a source-balanced
 * set ordered newest first. Feeds are fetched concurrently and a failure in one
 * is swallowed so the rest still serve.
 */
export async function aggregateFeeds(feeds, limit) {
  const results = await Promise.all(feeds.map(fetchFeed));
  return mergeArticles(results.flat(), limit);
}

/**
 * Cleans and balances an already-fetched set of articles. Exposed so callers
 * that mix RSS with another provider (Finnhub company-news) get identical
 * dedupe, filtering, and source balancing.
 */
export function mergeArticles(articles, limit) {
  const cleaned = dedupe(articles.filter((a) => !isNoise(a)));
  return interleaveBySource(cleaned, limit);
}
