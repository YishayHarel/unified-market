export interface BackendStockPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  isFallback?: boolean;
}

export interface BackendNewsArticle {
  title: string;
  description: string;
  source: { name: string };
  publishedAt: string;
  url: string;
  urlToImage?: string | null;
}

export interface BackendCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

const backendBaseUrl = import.meta.env.VITE_BACKEND_URL?.trim() || "http://localhost:4000";

export async function fetchStockPricesFromBackend(symbols: string[]): Promise<BackendStockPrice[]> {
  const response = await fetch(`${backendBaseUrl}/api/stock-prices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ symbols }),
  });

  if (!response.ok) {
    throw new Error(`Backend stock-prices failed: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Backend stock-prices returned invalid response");
  }

  return data;
}

export async function fetchNewsFromBackend(payload: {
  symbol?: string;
  pageSize?: number;
}): Promise<{ articles: BackendNewsArticle[]; status: string }> {
  const response = await fetch(`${backendBaseUrl}/api/news`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Backend news failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data || !Array.isArray(data.articles)) {
    throw new Error("Backend news returned invalid response");
  }

  return data;
}

export async function fetchStockCandlesFromBackend(payload: {
  symbol: string;
  period?: string;
  includeIndicators?: boolean;
}): Promise<{ candles: BackendCandle[] | null; indicators: any; error?: string }> {
  const response = await fetch(`${backendBaseUrl}/api/stock-candles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Backend stock-candles failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchStockFundamentalsFromBackend(symbol: string): Promise<any> {
  const response = await fetch(`${backendBaseUrl}/api/stock-fundamentals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ symbol }),
  });

  if (!response.ok) {
    throw new Error(`Backend stock-fundamentals failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchMarketSentimentFromBackend(): Promise<any> {
  const response = await fetch(`${backendBaseUrl}/api/market-sentiment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Backend market-sentiment failed: ${response.status}`);
  }
  return response.json();
}
