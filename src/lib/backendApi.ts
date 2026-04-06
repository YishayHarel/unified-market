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
