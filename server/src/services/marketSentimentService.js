import { nextFinnhubKey, getFinnhubKeys } from "./finnhubKeys.js";

const SENTIMENT_CACHE_MS = 60 * 1000;
let sentimentCache = null;
let sentimentExpiry = 0;

function analyzeSentiment(articles) {
  const positiveWords = ["gain", "rise", "bull", "growth", "strong", "optimistic", "rally", "surge"];
  const negativeWords = ["fall", "drop", "bear", "decline", "weak", "pessimistic", "crash", "plunge"];
  let positive = 0;
  let negative = 0;
  for (const article of (articles || []).slice(0, 20)) {
    const text = `${article?.headline || ""} ${article?.summary || ""}`.toLowerCase();
    for (const word of positiveWords) if (text.includes(word)) positive += 1;
    for (const word of negativeWords) if (text.includes(word)) negative += 1;
  }
  const total = positive + negative;
  if (total === 0) return "Neutral";
  const ratio = positive / total;
  if (ratio > 0.6) return "Positive";
  if (ratio < 0.4) return "Negative";
  return "Neutral";
}

function calcFearGreed(vixLevel) {
  if (vixLevel <= 12) return { score: 85, label: "Extreme Greed" };
  if (vixLevel <= 20) return { score: 70, label: "Greed" };
  if (vixLevel <= 30) return { score: 50, label: "Neutral" };
  if (vixLevel <= 40) return { score: 30, label: "Fear" };
  return { score: 15, label: "Extreme Fear" };
}

export async function getMarketSentiment() {
  if (sentimentCache && Date.now() < sentimentExpiry) {
    return sentimentCache;
  }

  const key = nextFinnhubKey();
  if (!key || !getFinnhubKeys().length) {
    throw new Error("FINNHUB_API_KEY or FINNHUB_API_KEYS not found");
  }

  const [uvxyRes, spyRes, newsRes, vxxRes] = await Promise.all([
    fetch(`https://finnhub.io/api/v1/quote?symbol=UVXY&token=${key}`),
    fetch(`https://finnhub.io/api/v1/quote?symbol=SPY&token=${key}`),
    fetch(`https://finnhub.io/api/v1/news?category=general&token=${key}`),
    fetch(`https://finnhub.io/api/v1/quote?symbol=VXX&token=${key}`),
  ]);

  if (!spyRes.ok || !newsRes.ok) {
    throw new Error("Failed to fetch market sentiment inputs");
  }

  const [uvxy, spy, news, vxx] = await Promise.all([
    uvxyRes.ok ? uvxyRes.json() : null,
    spyRes.json(),
    newsRes.json(),
    vxxRes.ok ? vxxRes.json() : null,
  ]);

  const volatility = (() => {
    if (uvxy?.c && uvxy?.pc) {
      const change = ((uvxy.c - uvxy.pc) / uvxy.pc) * 100;
      return { level: Math.max(12, Math.min(50, 15 + change * 0.5)), change: change / 1.5, source: "UVXY" };
    }
    if (vxx?.c && vxx?.pc) {
      const change = ((vxx.c - vxx.pc) / vxx.pc) * 100;
      return { level: Math.max(12, Math.min(50, 15 + change * 0.3)), change, source: "VXX" };
    }
    const spyChangeAbs = Math.abs(((spy.c - spy.pc) / spy.pc) * 100);
    return { level: Math.max(12, Math.min(40, 15 + spyChangeAbs * 3)), change: spyChangeAbs > 1 ? 5 : -2, source: "SPY-derived" };
  })();

  const fearGreed = calcFearGreed(volatility.level);
  const spyChange = ((spy.c - spy.pc) / spy.pc) * 100;
  const newsSentiment = analyzeSentiment(news);

  let marketHealth = 50;
  if (volatility.level < 20) marketHealth += 20;
  else if (volatility.level > 30) marketHealth -= 20;
  if (spyChange > 1) marketHealth += 15;
  else if (spyChange < -1) marketHealth -= 15;
  if (newsSentiment === "Positive") marketHealth += 10;
  else if (newsSentiment === "Negative") marketHealth -= 10;
  marketHealth = Math.max(0, Math.min(100, marketHealth));

  const sectorEtfs = ["XLK", "XLF", "XLV", "XLE", "XLI", "XLP", "XLU", "XLB", "XLRE"];
  const sectorResponses = await Promise.all(
    sectorEtfs.map((etf) => fetch(`https://finnhub.io/api/v1/quote?symbol=${etf}&token=${key}`)),
  );
  const sectorData = await Promise.all(sectorResponses.map((res) => (res.ok ? res.json() : null)));
  const sectorPerformance = sectorEtfs
    .map((etf, i) => {
      const data = sectorData[i];
      return data
        ? { sector: etf, change: ((data.c - data.pc) / data.pc) * 100, price: data.c }
        : { sector: etf, change: 0, price: 0 };
    })
    .sort((a, b) => b.change - a.change);

  const result = {
    fearGreedIndex: { score: fearGreed.score, label: fearGreed.label, vixLevel: volatility.level },
    marketMomentum: {
      spyChange: spyChange.toFixed(2),
      spyPrice: spy.c,
      direction: spyChange > 0 ? "Up" : spyChange < 0 ? "Down" : "Flat",
    },
    newsSentiment: { overall: newsSentiment, analysisNote: "Based on recent financial news headlines" },
    marketHealthScore: {
      score: marketHealth,
      label: marketHealth > 70 ? "Healthy" : marketHealth > 40 ? "Neutral" : "Unhealthy",
    },
    sectorRotation: {
      leaders: sectorPerformance.slice(0, 3),
      laggards: sectorPerformance.slice(-3),
      all: sectorPerformance,
    },
    indicators: {
      vix: {
        level: volatility.level,
        change: volatility.change,
        interpretation:
          volatility.level < 20
            ? "Low volatility (bullish)"
            : volatility.level > 30
              ? "High volatility (bearish)"
              : "Moderate volatility",
        source: volatility.source,
        note: `Estimated from ${volatility.source}`,
      },
    },
    timestamp: new Date().toISOString(),
  };

  sentimentCache = result;
  sentimentExpiry = Date.now() + SENTIMENT_CACHE_MS;
  return result;
}
