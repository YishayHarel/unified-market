/**
 * Regression cases for the news ticker tagger.
 *
 * Run with: npm run test:tagger
 *
 * The tagger is a heuristic over ~12k listed company names, and every case here
 * comes from a real headline it got wrong at some point. Most of them are false
 * positives, which matter more than misses: a wrongly tagged article shows up
 * on a stock page it has nothing to do with, while a missed tag just costs one
 * entry in a list. Add a case whenever you tune the matching rules.
 */

import {
  buildMatcher,
  extractTickers,
  type StockRef,
} from "../supabase/functions/_shared/tickerTag.ts";

// Mirrors how these names really appear in the stocks table, share-class
// markers and all.
const UNIVERSE: StockRef[] = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "AMD", name: "Advanced Micro Devices, Inc.", is_top_100: true },
  { symbol: "UPS", name: "United Parcel Service, Inc.", is_top_100: true },
  { symbol: "NVDA", name: "NVIDIA Corporation", is_top_100: true },
  { symbol: "TSLA", name: "Tesla, Inc." },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "BABA", name: "ALIBABA GROUP HOLDING-SP ADR" },
  { symbol: "UBER", name: "UBER TECHNOLOGIES INC" },
  { symbol: "POST", name: "POST HOLDINGS INC" },
  { symbol: "AIRL", name: "THEMES AIRLINES ETF" },
  { symbol: "BILL", name: "BILL HOLDINGS INC" },
  { symbol: "UPC", name: "UNIVERSE PHARMACEUTICALS INC" },
  { symbol: "SCTTF", name: "SCOTT TECHNOLOGY LTD" },
  { symbol: "TGT", name: "TARGET CORP" },
  { symbol: "DFS", name: "Discover Financial Services" },
  { symbol: "V", name: "Visa Inc." },
  { symbol: "SYF", name: "Synchrony Financial" },
  { symbol: "LMT", name: "Lockheed Martin Corporation" },
  { symbol: "ALL", name: "The Allstate Corporation" },
  { symbol: "GM", name: "General Motors Company" },
  { symbol: "C", name: "Citigroup Inc." },
  { symbol: "PDD", name: "PDD Holdings Inc. Sponsored ADR" },
];

const CASES: Array<{ text: string; expect: string[]; why: string }> = [
  // Company names, the common case.
  { text: "Microsoft Just Announced Great News for AMD Investors", expect: ["MSFT", "AMD"], why: "name plus prominent bare ticker" },
  { text: "Apple vs. CoreWeave: Comparing Revenue Trends", expect: ["AAPL"], why: "plain name" },
  { text: "Nvidia is due to report earnings on Wednesday", expect: ["NVDA"], why: "plain name" },
  { text: "Lockheed Martin wins defense contract", expect: ["LMT"], why: "multi-word name" },
  { text: "Citigroup has room to buy a big bank", expect: ["C"], why: "single-letter symbol via name" },

  // Normalisation of how listings are actually recorded.
  { text: "UPS Stopped Carrying 2 Million Amazon Packages a Day", expect: ["UPS", "AMZN"], why: "Amazon.com must reduce to 'amazon'" },
  { text: "Alibaba plunges after announcing buyback", expect: ["BABA"], why: "hyphenated share-class markers stripped" },
  { text: "Uber partners with China's Pony.ai for robotaxis", expect: ["UBER"], why: "four-letter short name kept" },
  { text: "Synchrony announces partnership with OpenAI", expect: ["SYF"], why: "industry descriptor dropped" },

  // Explicit notation is always trusted, even for ambiguous names.
  { text: "Buy $NVDA now? One analyst says yes", expect: ["NVDA"], why: "$TICKER" },
  { text: "$TGT beats earnings expectations", expect: ["TGT"], why: "ambiguous name still works explicitly" },
  { text: "Why the Market Dipped But PDD Holdings Inc. Sponsored ADR (PDD) Reached $86.94", expect: ["PDD"], why: "(TICKER)" },
  { text: "NASDAQ:TSLA jumps on Cybercab news", expect: ["TSLA"], why: "EXCHANGE:TICKER" },

  // False positives — each of these tagged something wrong on a live headline.
  { text: "All eyes on the Fed as it weighs a cut", expect: [], why: "ALL/IT/ON are real tickers" },
  { text: "Analyst raises price target on chip stocks", expect: [], why: "TARGET CORP vs 'price target'" },
  { text: "Investors discover new opportunities in energy", expect: [], why: "Discover Financial vs the verb" },
  { text: "Applying for a travel visa got harder this year", expect: [], why: "Visa Inc. vs the document" },
  { text: "Wells Fargo and Citigroup have room to buy a bank. The bill comes later", expect: ["C"], why: "BILL Holdings must not match 'the bill'" },
  { text: "Burry said in a post on Substack", expect: [], why: "POST Holdings vs 'a post'" },
  { text: "a very broad universe of companies tied to the themes", expect: [], why: "Universe Pharma / Themes Airlines" },
  // "United" here is United Airlines, not United Parcel Service. Matching UPS
  // off a shared first word would be exactly the kind of wrong tag this suite
  // exists to prevent, so the correct answer is nothing.
  { text: "After 10 years at United, CEO Scott Kirby is thinking big", expect: [], why: "Scott Technology must not match a person, and a shared first word is not a match" },
  { text: "General market conditions weighed on stocks", expect: [], why: "General Motors vs 'general'" },
  { text: "Nvidia is the beating heart of the AI boom", expect: ["NVDA"], why: "AI and other acronyms are not tickers here" },
];

const matcher = buildMatcher(UNIVERSE);
let failures = 0;

for (const { text, expect, why } of CASES) {
  const got = extractTickers(text, matcher).sort();
  const want = [...expect].sort();
  const ok = JSON.stringify(got) === JSON.stringify(want);

  if (ok) {
    console.log(`  PASS  ${text.slice(0, 58)}`);
  } else {
    failures++;
    console.log(`  FAIL  ${text.slice(0, 58)}`);
    console.log(`        ${why}`);
    console.log(`        want [${want}] got [${got}]`);
  }
}

console.log(`\n${CASES.length - failures}/${CASES.length} passed`);
if (failures > 0) process.exit(1);
