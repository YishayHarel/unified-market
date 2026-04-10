import { nextFinnhubKey } from "./finnhubKeys.js";

const candleCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key) {
  const cached = candleCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }
  candleCache.delete(key);
  return null;
}

function setCached(key, data) {
  candleCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

function getPeriodParams(period) {
  switch (period) {
    case "1H":
    case "1D":
      return { resolution: "5", fromDays: 1, tdInterval: "5min", tdOutputsize: 288 };
    case "1W":
      return { resolution: "60", fromDays: 7, tdInterval: "1h", tdOutputsize: 200 };
    case "1M":
      return { resolution: "D", fromDays: 30, tdInterval: "1day", tdOutputsize: 50 };
    case "3M":
      return { resolution: "D", fromDays: 90, tdInterval: "1day", tdOutputsize: 140 };
    case "1Y":
      return { resolution: "D", fromDays: 365, tdInterval: "1day", tdOutputsize: 320 };
    case "MAX":
      return { resolution: "W", fromDays: 365 * 5, tdInterval: "1week", tdOutputsize: 320 };
    default:
      return { resolution: "D", fromDays: 30, tdInterval: "1day", tdOutputsize: 50 };
  }
}

async function fetchFinnhubCandles(symbol, resolution, from, to) {
  const key = nextFinnhubKey();
  if (!key) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${key}`,
      { signal: controller.signal, headers: { "User-Agent": "UnifiedMarket/1.0" } },
    );

    if (!response.ok) return null;
    const data = await response.json();
    if (data?.s === "no_data" || !Array.isArray(data?.c) || data.c.length === 0) {
      return null;
    }

    return data.t.map((timestamp, i) => ({
      timestamp: timestamp * 1000,
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i],
    }));
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchTwelveDataCandles(symbol, interval, outputsize) {
  const apiKey = (process.env.TWELVE_DATA_API_KEY ?? "").trim();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const url =
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}` +
    `&interval=${encodeURIComponent(interval)}&outputsize=${outputsize}&format=JSON&apikey=${apiKey}`;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "UnifiedMarket/1.0" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data?.values) || data.values.length === 0) return null;

    return data.values
      .map((v) => ({
        timestamp: new Date(v.datetime).getTime(),
        open: Number(v.open),
        high: Number(v.high),
        low: Number(v.low),
        close: Number(v.close),
        volume: v.volume !== undefined ? Number(v.volume) : null,
      }))
      .filter((c) => Number.isFinite(c.timestamp) && Number.isFinite(c.close))
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchAlphaVantageCandles(symbol, outputsize) {
  const apiKey = (process.env.ALPHA_VANTAGE_API_KEY ?? "").trim();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=${outputsize}&apikey=${apiKey}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "UnifiedMarket/1.0" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const timeSeries = data?.["Time Series (Daily)"];
    if (!timeSeries) return null;

    return Object.entries(timeSeries)
      .map(([date, values]) => ({
        timestamp: new Date(date).getTime(),
        open: parseFloat(values["1. open"]),
        high: parseFloat(values["2. high"]),
        low: parseFloat(values["3. low"]),
        close: parseFloat(values["4. close"]),
        volume: parseInt(values["5. volume"], 10),
      }))
      .filter((c) => Number.isFinite(c.timestamp) && Number.isFinite(c.close))
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function calculateIndicators(candles) {
  if (!Array.isArray(candles) || candles.length < 26) return null;
  const closes = candles.map((c) => Number(c.close)).filter(Number.isFinite);
  if (closes.length < 26) return null;

  const sma = (period) => {
    if (closes.length < period) return 0;
    const slice = closes.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  };

  const emaSeries = (period) => {
    const k = 2 / (period + 1);
    const out = [closes[0]];
    for (let i = 1; i < closes.length; i += 1) {
      out.push(closes[i] * k + out[i - 1] * (1 - k));
    }
    return out;
  };

  const calculateRSI = (period = 14) => {
    if (closes.length < period + 1) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - period; i < closes.length; i += 1) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - 100 / (1 + rs);
  };

  const ema12 = emaSeries(12);
  const ema26 = emaSeries(26);
  const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
  const macdPoints = ema12.slice(-9).map((v, i) => v - ema26[ema26.length - 9 + i]);
  const signalSeries = (() => {
    const k = 2 / (9 + 1);
    const out = [macdPoints[0] || 0];
    for (let i = 1; i < macdPoints.length; i += 1) {
      out.push(macdPoints[i] * k + out[i - 1] * (1 - k));
    }
    return out;
  })();
  const macdSignal = signalSeries[signalSeries.length - 1] || 0;
  const macdHistogram = macdLine - macdSignal;

  const sma20 = sma(20);
  const stdDev = Math.sqrt(
    closes.slice(-20).reduce((sum, val) => sum + (val - sma20) ** 2, 0) / 20,
  );

  return {
    sma20,
    sma50: sma(50),
    ema12: ema12[ema12.length - 1],
    ema26: ema26[ema26.length - 1],
    rsi: calculateRSI(14),
    macdLine,
    macdSignal,
    macdHistogram,
    upperBand: sma20 + stdDev * 2,
    lowerBand: sma20 - stdDev * 2,
    middleBand: sma20,
    currentPrice: closes[closes.length - 1],
    source: "calculated",
  };
}

/** Match Supabase get-stock-candles: Finnhub is weak for many ETFs; AV/TD first. */
const ETF_SYMBOLS_PRIMARY_AV = new Set([
  "SHY",
  "IEF",
  "UVXY",
  "TLT",
  "SPY",
  "QQQ",
  "VOO",
  "ONEQ",
  "IVV",
  "DIA",
  "IWM",
  "VTI",
  "VXX",
  "VIXY",
]);

export async function getStockCandles({ symbol, period = "1D", includeIndicators = false }) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  if (!normalizedSymbol) {
    throw new Error("symbol is required");
  }

  const { resolution, fromDays, tdInterval, tdOutputsize } = getPeriodParams(period);
  const cacheKey = `${normalizedSymbol}-${period}`;
  let candles = getCached(cacheKey);

  if (!candles) {
    const to = Math.floor(Date.now() / 1000);
    const from = to - fromDays * 24 * 60 * 60;
    const cutoffMs = Date.now() - fromDays * 24 * 60 * 60 * 1000;
    const avOutputsize = fromDays > 100 ? "full" : "compact";

    if (ETF_SYMBOLS_PRIMARY_AV.has(normalizedSymbol)) {
      const avCandles = await fetchAlphaVantageCandles(normalizedSymbol, avOutputsize);
      if (Array.isArray(avCandles) && avCandles.length > 0) {
        candles = avCandles.filter((c) => c.timestamp >= cutoffMs);
      }
      if (!candles) {
        candles = await fetchTwelveDataCandles(normalizedSymbol, tdInterval, tdOutputsize);
      }
      if (!candles) {
        candles = await fetchFinnhubCandles(normalizedSymbol, resolution, from, to);
      }
    } else {
      candles = await fetchFinnhubCandles(normalizedSymbol, resolution, from, to);
      if (!candles) {
        candles = await fetchTwelveDataCandles(normalizedSymbol, tdInterval, tdOutputsize);
      }
      if (!candles) {
        const avCandles = await fetchAlphaVantageCandles(normalizedSymbol, avOutputsize);
        if (Array.isArray(avCandles) && avCandles.length > 0) {
          candles = avCandles.filter((c) => c.timestamp >= cutoffMs);
        }
      }
    }
    if (candles) {
      setCached(cacheKey, candles);
    }
  }

  if (!Array.isArray(candles) || candles.length === 0) {
    return { candles: null, indicators: null, error: "No data available" };
  }

  let indicators = null;
  if (includeIndicators) {
    const indicatorCacheKey = `${normalizedSymbol}-indicators-${period}`;
    indicators = getCached(indicatorCacheKey);
    if (!indicators) {
      indicators = calculateIndicators(candles);
      if (indicators) {
        setCached(indicatorCacheKey, indicators);
      }
    }
  }

  return { candles, indicators };
}
