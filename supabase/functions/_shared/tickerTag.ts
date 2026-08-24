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
  /** Normalised company name -> symbol, looked up by n-gram. */
  byName: Map<string, string>;
  /** Longest name in words, bounding how many n-grams we generate. */
  maxNameWords: number;
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

/**
 * Longest company name, in words, we will try to match. Registered names run to
 * a dozen words ("... Sponsored ADR Class A Ordinary Shares") but headlines
 * never use them, and every extra word multiplies the n-grams we generate.
 */
const MAX_NAME_WORDS = 5;

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
 * Company names that are also everyday words in market writing. "Target Corp"
 * normalises to "target", which would tag TGT on every "analyst raises price
 * target". These are matched only through explicit notation ($TGT, "(TGT)"),
 * which is handled separately and needs no name match.
 */
const AMBIGUOUS_NAMES = new Set([
  "target", "gap", "block", "match", "shell", "unity", "visa", "discover",
  "progressive", "principal", "travelers", "equity", "advance", "science",
  "sun", "arrow", "banner", "square", "peak", "journey", "range", "signature",
]);

/**
 * Reduces "Apple Inc." to "apple" so it matches how headlines actually refer to
 * a company. Returns every distinct form worth searching for, longest first.
 */
function companyNeedles(name: string): string[] {
  const full = name
    .replace(NAME_SUFFIX, " ")
    // "Amazon.com Inc." must reduce to "amazon", not "amazon com", or it never
    // matches a headline that just says "Amazon".
    .replace(/\.(com|net|org|io|ai|co)\b/gi, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // Short remnants ("hp", "3m") collide with prose too easily to match on.
  if (full.length < 4) return [];
  if (AMBIGUOUS_NAMES.has(full)) return [];

  const needles = [full];

  // "synchrony financial" -> also try "synchrony".
  const short = full.replace(INDUSTRY_DESCRIPTOR, "").trim();
  if (
    short !== full &&
    short.length >= 5 &&
    !GENERIC_LEAD_WORDS.has(short.split(" ")[0]) &&
    !AMBIGUOUS_NAMES.has(short)
  ) {
    needles.push(short);
  }

  return needles;
}

export function buildMatcher(stocks: StockRef[]): TickerMatcher {
  const bySymbol = new Map<string, string>();
  const byName = new Map<string, string>();
  let maxNameWords = 1;

  for (const stock of stocks) {
    const symbol = stock.symbol?.trim().toUpperCase();
    if (!symbol) continue;
    bySymbol.set(symbol, symbol);

    if (!stock.name) continue;
    for (const needle of companyNeedles(stock.name)) {
      // Several listings share a name (ordinary shares, ADRs, foreign lines).
      // Keeping the first occurrence makes the result deterministic; preferring
      // the shorter symbol favours the primary US listing (BABA over BABAF).
      const words = needle.split(" ").length;
      if (words > MAX_NAME_WORDS) continue;

      const existing = byName.get(needle);
      if (existing && existing.length <= symbol.length) continue;
      byName.set(needle, symbol);
      if (words > maxNameWords) maxNameWords = words;
    }
  }

  return { bySymbol, byName, maxNameWords };
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
  //
  //    Tokenise once and look up n-grams rather than testing a regex per known
  //    name: with ~30k listed symbols the per-name scan is millions of regex
  //    executions per article, while this is proportional to article length.
  //    Periods split words here so "Amazon.com" yields "amazon", matching the
  //    needle. Symbol matching above works on the raw text, so dotted tickers
  //    like BRK.B are unaffected.
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (let i = 0; i < words.length; i++) {
    for (let n = 1; n <= matcher.maxNameWords && i + n <= words.length; n++) {
      const symbol = matcher.byName.get(words.slice(i, i + n).join(" "));
      if (symbol) found.add(symbol);
    }
  }

  return [...found];
}
