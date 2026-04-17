# UnifiedMarket architecture

## Overview

- **Frontend (`src/`)** — React (Vite). Talks to Supabase (database + auth + Edge Functions) and optionally to **Express** (`VITE_BACKEND_URL`) for market routes.
- **Database & auth** — **Supabase PostgreSQL** with Row Level Security; **Supabase Auth** for sessions.
- **Serverless APIs** — **Supabase Edge Functions** (`supabase/functions/`) for prices, candles, news, earnings, AI, etc. Secrets live in the Supabase dashboard.
- **Modular Node API** — **`server/`** (Express) mirrors key market endpoints (`/api/stock-prices`, `/api/stock-candles`, …) so you can host logic on Render/Fly/etc., rotate keys independently, and keep heavy or rate-limited work off the browser.

## Data flow (market data)

1. Browser prefers **Edge** or **Express** depending on feature (e.g. candles use `fetchStockCandlesReliable` in `src/lib/stockCandlesFetch.ts`).
2. **Finnhub** is the primary quote source; **Twelve Data** is used as a **fallback for quotes** when Finnhub has no row, and for **candles** when Finnhub fails (see `get-stock-candles` / `stockCandlesService.js`).
3. **Alpha Vantage** backs up candles and some ETF paths where Finnhub returns no data.

## Deploy

- **Edge Functions** — GitHub Action `.github/workflows/deploy-supabase-functions.yml` or `supabase functions deploy`.
- **Express** — deploy `server/` to your host; set `CORS_ORIGIN` and provider keys in that environment.
