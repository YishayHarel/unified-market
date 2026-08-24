/**
 * Finds stock symbols mentioned in a headline.
 *
 * Precision matters far more than recall here: a wrongly tagged article shows
 * up on a stock page it has nothing to do with, which reads as a broken site.
 * A missed tag just means one fewer article in a list.
 *
 * The naive approach — scan for any known symbol — is unusable, because a large
 * share of real tickers are ordinary English words (A, ALL, IT, ON, KEY, FUN,
 * CAR, NOW, TRUE, OPEN...). "All eyes on the Fed" would tag ALL and ON. So bare
 * uppercase tokens are only accepted when they are unambiguous, while explicit
 * finance notation ($AAPL, "(AAPL)") is always trusted.
 */

export interface StockRef {
  symbol: string;
  name: string | null;
}

export interface TickerMatcher {
  bySymbol: Map<string, string>;
  byName: Array<{ needle: string; symbol: string }>;
}

/**
 * Uppercase tokens that are far more likely to be prose, an acronym, or a
 * country code than a ticker in a headline. Each is a real listed symbol.
 */
const AMBIGUOUS_SYMBOLS = new Set([
  "A", "ALL", "AN", "AND", "ANY", "ARE", "AS", "AT", "BE", "BIG", "BY", "CAR",
  "CEO", "CFO", "DD", "DO", "EAT", "EU", "FOR", "FUN", "GO", "GOOD", "HAS",
  "HE", "HOPE", "IT", "KEY", "LOVE", "NEW", "NEWS", "NOW", "OF", "ON", "ONE",
  "OPEN", "OR", "OUT", "PLAY", "REAL", "RIDE", "RUN", "SAFE", "SAVE", "SO",
  "TRUE", "TV", "UK", "US", "USA", "WELL", "WORK", "YOU",
]);

/** Corporate suffixes stripped before name matching. */
const NAME_SUFFIX = new RegExp(
  String.raw`\s*(,)?\s*\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|llc|lp|holdings?|group|the|sa|nv|ag|se|class\s+[a-c]|common\s+stock|ordinary\s+shares?)\b\.?`,
  "gi",
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Industry descriptors headlines routinely drop: the news says "Synchrony",
 * never "Synchrony Financial".
 */
const INDUSTRY_DESCRIPTOR = new RegExp(
  String.raw`\s+\b(financial|technologies|technology|systems|motors|industries|energy|pharmaceuticals?|bancorp|bancshares|communications|entertainment|resources|partners|capital|international|solutions|services|networks|laboratories|enterprises|properties|brands|stores|airlines|semiconductor)\b.*$`,
  "i",
);

/**
 * Leading words too generic to identify a company on their own — "General"
 * would match "general market conditions".
 */
const GENERIC_LEAD_WORDS = new Set([
  "general", "american", "national", "united", "first", "global", "standard",
  "pacific", "western", "eastern", "northern", "southern", "premier", "allied",
  "advanced", "central", "federal", "liberty", "summit", "pioneer", "frontier",
]);

/**
 * Reduces "Apple Inc." to "apple" so it matches how headlines actually refer to
 * a company. Returns every distinct form worth searching for, longest first.
 */
function companyNeedles(name: string): string[] {
  const full = name
    .replace(NAME_SUFFIX, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // Short remnants ("hp", "3m") collide with prose too easily to match on.
  if (full.length < 4) return [];

  const needles = [full];

  // "synchrony financial" -> also try "synchrony".
  const short = full.replace(INDUSTRY_DESCRIPTOR, "").trim();
  if (
    short !== full &&
    short.length >= 5 &&
    !GENERIC_LEAD_WORDS.has(short.split(" ")[0])
  ) {
    needles.push(short);
  }

  return needles;
}

export function buildMatcher(stocks: StockRef[]): TickerMatcher {
  const bySymbol = new Map<string, string>();
  const byName: Array<{ needle: string; symbol: string }> = [];

  for (const stock of stocks) {
    const symbol = stock.symbol?.trim().toUpperCase();
    if (!symbol) continue;
    bySymbol.set(symbol, symbol);

    if (stock.name) {
      for (const needle of companyNeedles(stock.name)) {
        byName.push({ needle, symbol });
      }
    }
  }

  byName.sort((a, b) => b.needle.length - a.needle.length);
  return { bySymbol, byName };
}

export function extractTickers(text: string, matcher: TickerMatcher): string[] {
  if (!text) return [];
  const found = new Set<string>();

  // 1. Explicit notation: $AAPL, (AAPL), NASDAQ:AAPL. Unambiguous by
  //    construction, so accept these even for otherwise-ambiguous symbols.
  for (const match of text.matchAll(/\$([A-Za-z][A-Za-z.\-]{0,6})\b/g)) {
    const symbol = match[1].toUpperCase();
    if (matcher.bySymbol.has(symbol)) found.add(symbol);
  }
  for (const match of text.matchAll(/\(([A-Z][A-Z.\-]{0,6})\)/g)) {
    if (matcher.bySymbol.has(match[1])) found.add(match[1]);
  }
  for (const match of text.matchAll(/\b(?:NYSE|NASDAQ|AMEX)\s*:\s*([A-Z][A-Z.\-]{0,6})\b/gi)) {
    const symbol = match[1].toUpperCase();
    if (matcher.bySymbol.has(symbol)) found.add(symbol);
  }

  // 2. Bare uppercase tokens, only when unambiguous: at least three characters
  //    and not an everyday word.
  for (const match of text.matchAll(/\b([A-Z]{3,6})\b/g)) {
    const symbol = match[1];
    if (AMBIGUOUS_SYMBOLS.has(symbol)) continue;
    if (matcher.bySymbol.has(symbol)) found.add(symbol);
  }

  // 3. Company names, which is how headlines usually refer to a company.
  const haystack = text.toLowerCase();
  for (const { needle, symbol } of matcher.byName) {
    if (found.has(symbol)) continue;
    const boundary = new RegExp(`\\b${escapeRegExp(needle)}\\b`);
    if (boundary.test(haystack)) found.add(symbol);
  }

  return [...found];
}
