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
  /**
   * Widely-followed listing. Only these are matched from a bare uppercase
   * ticker, because that pattern is safe for AMD or UPS and disastrous across
   * the whole universe.
   */
  is_top_100?: boolean | null;
}

export interface TickerMatcher {
  bySymbol: Map<string, string>;
  /** Normalised company name -> symbol, looked up by n-gram. */
  byName: Map<string, string>;
  /** Symbols safe to match from a bare uppercase token. */
  prominent: Set<string>;
  /** Longest name in words, bounding how many n-grams we generate. */
  maxNameWords: number;
}

/** Corporate suffixes stripped before name matching. */
const NAME_SUFFIX = new RegExp(
  String.raw`\s*(,)?\s*\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|llc|lp|holdings?|group|the|sa|nv|ag|se|adr|ads|sp|sponsored|unsponsored|cl|class\s+[a-c]|ord|ordinary|common\s+stock|shares?|shs|units?|new)\b\.?`,
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
 * English function words: prepositions, conjunctions, determiners, pronouns,
 * auxiliaries.
 *
 * Requiring a capital letter stops most one-word false positives, but not in a
 * Title Case headline where every word is capitalised anyway — "Which AI Stock
 * Will Bring You Profits in 2026 and Beyond?" still tagged Beyond Inc.
 *
 * Unlike ordinary vocabulary, which is open-ended and cannot be listed, function
 * words are a closed class: this is very nearly all of them, and no new ones are
 * coming. A company whose whole name is one of these can only ever be matched
 * through explicit notation, and that is the right trade — "Beyond", "Next" and
 * "Under" appear as prepositions in headlines thousands of times more often than
 * as the company.
 */
const FUNCTION_WORDS = new Set([
  "about", "above", "across", "after", "against", "along", "among", "around",
  "because", "before", "behind", "below", "beneath", "beside", "besides",
  "between", "beyond", "both", "down", "during", "each", "either", "every",
  "except", "from", "have", "here", "however", "inside", "into", "less", "many",
  "more", "most", "much", "near", "neither", "next", "nothing", "once", "only",
  "onto", "over", "past", "same", "since", "some", "such", "than", "that",
  "their", "them", "then", "there", "these", "they", "this", "those", "through",
  "toward", "towards", "under", "until", "upon", "very", "were", "what", "when",
  "where", "which", "while", "will", "with", "within", "without", "would",
  "your",
]);

/**
 * Company names that are also everyday words in market writing. "Target Corp"
 * normalises to "target", which would tag TGT on every "analyst raises price
 * target". These are matched only through explicit notation ($TGT, "(TGT)"),
 * which is handled separately and needs no name match.
 */
const AMBIGUOUS_NAMES = new Set([
  // Brand names that are also everyday words.
  "target", "gap", "block", "match", "shell", "unity", "visa", "discover",
  "progressive", "principal", "travelers", "equity", "advance", "science",
  "sun", "arrow", "banner", "square", "peak", "journey", "range", "signature",
  // Each of these was observed tagging a real headline wrongly: BILL Holdings
  // on "the bill", Universe Pharmaceuticals on "universe", POST Holdings on
  // "a post on Substack", Themes Airlines ETF on "the themes that...".
  "bill", "universe", "next", "demand", "giant", "critical", "scott", "test",
  "post", "themes", "themes airlines",
  // Liquidity Services, Monday.com and Strategy Inc are all real listings whose
  // names are unremarkable words: they tagged a story on a Russian bank run, an
  // oil-sanctions piece, and "Why Target Stock Keeps Going Up".
  "liquidity", "monday", "tuesday", "wednesday", "thursday", "friday",
  "saturday", "sunday", "strategy", "service", "services", "global",
  // Corporate filler that survives suffix stripping on its own.
  "technology", "solutions", "systems", "holdings", "group", "brands", "power",
  "capital", "growth", "value", "income", "select", "core", "quality",
  "momentum", "vision", "focus", "summit", "apex", "vertex", "origin", "impact",
  "bridge", "anchor", "beacon", "compass", "catalyst", "spark", "surge", "wave",
  "leap", "reach", "align", "assure", "secure", "trust", "future", "pioneer",
  "venture", "legacy", "heritage", "prime", "elite", "premier",
  // Ordinary vocabulary that shows up constantly in market writing. A
  // single-word company name colliding with any of these is a false positive
  // far more often than a real mention.
  "half", "gain", "gains", "loss", "rise", "fall", "drop", "jump", "move",
  "plan", "plans", "deal", "deals", "case", "cost", "costs", "rate", "rates",
  "risk", "risks", "line", "lines", "life", "live", "team", "time", "week",
  "year", "york", "wall", "main", "bank", "bond", "cash", "debt", "fund",
  "loan", "sale", "sales", "shop", "unit", "wage", "work", "home", "food",
  "fuel", "gold", "iron", "coal", "corn", "milk", "beef", "port", "road",
  "ship", "site", "star", "step", "stop", "term", "test", "tool", "view",
  "vote", "wing", "zone", "boom", "bull", "bear", "edge", "flow", "form",
  "goal", "hold", "idea", "lead", "lift", "mark", "mind", "name", "note",
  "pace", "pair", "park", "part", "past", "path", "pick", "play", "plus",
  "pool", "push", "race", "rally", "read", "real", "rest", "ride", "ring",
  "rock", "role", "room", "root", "rule", "safe", "save", "seat", "seed",
  "sign", "size", "skip", "slip", "snap", "soft", "sort", "spot", "swap",
  "tide", "tier", "tone", "tour", "town", "turn", "wave", "west", "east",
  "north", "south", "level", "share", "shares", "stock", "stocks", "price",
  "trade", "money", "world", "state", "board", "chief", "field", "front",
  "green", "guard", "guide", "house", "index", "input", "issue", "labor",
  "large", "later", "light", "limit", "local", "major", "metal", "model",
  "month", "north", "order", "other", "outer", "owner", "panel", "paper",
  "party", "phase", "photo", "piece", "pilot", "pitch", "place", "plant",
  "plate", "point", "policy", "power", "press", "prime", "print", "prize",
  "probe", "proof", "pulse", "punch", "quest", "quiet", "quote", "reach",
  "ready", "realm", "rebel", "reply", "right", "rival", "river", "round",
  "route", "royal", "rural", "scale", "scene", "scope", "score", "sense",
  "serve", "setup", "shade", "shape", "shift", "shine", "shock", "shore",
  "short", "sight", "skill", "slate", "slide", "small", "smart", "solid",
  "sound", "south", "space", "spare", "speed", "spend", "spike", "split",
  "sport", "squad", "stage", "stake", "stand", "start", "steam", "steel",
  "still", "stone", "store", "storm", "story", "strip", "study", "style",
  "sugar", "super", "sweep", "swing", "table", "taste", "teach", "theme",
  "there", "thing", "think", "third", "those", "three", "throw", "tiger",
  "title", "today", "token", "topic", "total", "touch", "tough", "tower",
  "track", "train", "trend", "trial", "tribe", "trick", "trust", "truth",
  "twist", "under", "union", "unite", "unity", "upper", "urban", "usage",
  "using", "valid", "valley", "vapor", "vault", "venue", "verse", "video",
  "virus", "visit", "vital", "vivid", "voice", "watch", "water", "wheel",
  "where", "which", "while", "white", "whole", "wider", "windy", "woman",
  "world", "worth", "would", "wound", "wrist", "write", "wrong", "yield",
  "young", "youth",
]);

/**
 * Reduces "Apple Inc." to "apple" so it matches how headlines actually refer to
 * a company. Returns every distinct form worth searching for, longest first.
 */
function companyNeedles(name: string): string[] {
  const full = name
    // Listing names hyphenate their share-class markers ("ALIBABA GROUP
    // HOLDING-SP ADR"), which would otherwise survive suffix stripping.
    .replace(/[-/]+/g, " ")
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
  if (AMBIGUOUS_NAMES.has(full) || FUNCTION_WORDS.has(full)) return [];

  const needles = [full];

  // "synchrony financial" -> also try "synchrony".
  const short = full.replace(INDUSTRY_DESCRIPTOR, "").trim();
  // Four characters, not five: "Uber Technologies" reduces to "uber", and the
  // ambiguity list is what keeps short names honest.
  if (
    short !== full &&
    short.length >= 4 &&
    !GENERIC_LEAD_WORDS.has(short.split(" ")[0]) &&
    !AMBIGUOUS_NAMES.has(short) &&
    !FUNCTION_WORDS.has(short)
  ) {
    needles.push(short);
  }

  return needles;
}

export function buildMatcher(stocks: StockRef[]): TickerMatcher {
  const bySymbol = new Map<string, string>();
  const byName = new Map<string, string>();
  const prominent = new Set<string>();
  let maxNameWords = 1;

  for (const stock of stocks) {
    const symbol = stock.symbol?.trim().toUpperCase();
    if (!symbol) continue;
    bySymbol.set(symbol, symbol);
    if (stock.is_top_100) prominent.add(symbol);

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

  return { bySymbol, byName, prominent, maxNameWords };
}

interface Token {
  /** As written, so capitalisation survives. */
  raw: string;
  lower: string;
}

/**
 * Splits text into words while keeping the original capitalisation.
 *
 * The name scan used to lowercase everything up front, which threw away the one
 * signal that reliably separates a company from a common noun. Punctuation
 * still splits words, so "Amazon.com" yields "Amazon" and "com" and matches the
 * "amazon" needle.
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const word of text.replace(/[^A-Za-z0-9]+/g, " ").split(/\s+/)) {
    if (word) tokens.push({ raw: word, lower: word.toLowerCase() });
  }
  return tokens;
}

/**
 * Whether a one-word company name matched here is plausibly the company.
 *
 * Single-word names are where this goes wrong, because plenty of listed
 * companies are named after ordinary words. Two live examples: "U.S. strikes
 * Iranian rocket launchers near Strait of Hormuz" was tagged RCKT because
 * Rocket Pharmaceuticals exists, and "could become a dividend beast over the
 * next decade and beyond" was tagged BYON for Beyond Inc.
 *
 * The denylist below caught neither, and never will catch the next one — it is
 * a hand-written list of English words growing one bug at a time. The rule that
 * actually generalises is that a company is a proper noun: every publisher
 * capitalises Rocket Pharmaceuticals and none capitalises a rocket launcher.
 * So a one-word name has to appear capitalised to count.
 *
 * This does not save a Title Case headline, where everything is capitalised and
 * the signal is gone; the denylist is still what covers the worst of those.
 */
function isCredibleSingleWordMatch(token: Token): boolean {
  return /^[A-Z]/.test(token.raw);
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

  // 2. Bare uppercase tickers, but only for widely-followed names. Headlines
  //    write "AMD" and "UPS" without decoration, so this is worth having — yet
  //    across the whole universe ordinary acronyms collide with real symbols
  //    (CBO, UPC, GDP, IPO, ETF all resolve to tickers), which tagged "Nvidia
  //    is the beating heart of the AI boom" with four unrelated companies.
  for (const match of text.matchAll(/\b([A-Z]{2,6})\b/g)) {
    if (matcher.prominent.has(match[1])) found.add(match[1]);
  }

  // 3. Company names, which is how headlines usually refer to a company.
  //
  //    Tokenise once and look up n-grams rather than testing a regex per known
  //    name: with ~30k listed symbols the per-name scan is millions of regex
  //    executions per article, while this is proportional to article length.
  //    Periods split words here so "Amazon.com" yields "amazon", matching the
  //    needle. Symbol matching above works on the raw text, so dotted tickers
  //    like BRK.B are unaffected.
  const tokens = tokenize(text);

  for (let i = 0; i < tokens.length; i++) {
    for (let n = 1; n <= matcher.maxNameWords && i + n <= tokens.length; n++) {
      const needle = tokens.slice(i, i + n).map((t) => t.lower).join(" ");
      const symbol = matcher.byName.get(needle);
      if (!symbol) continue;

      // Multi-word names are specific enough to stand on their own; a single
      // word has to look like a proper noun.
      if (n === 1 && !isCredibleSingleWordMatch(tokens[i])) continue;

      found.add(symbol);
    }
  }

  return [...found];
}
