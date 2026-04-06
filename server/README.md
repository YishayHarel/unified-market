# UnifiedMarket Express Backend

## Run

```bash
npm install
npm run dev
```

## Endpoints

- `GET /health`
- `POST /api/stock-prices`
- `POST /api/news`
- `POST /api/stock-candles`
- `POST /api/stock-fundamentals`
- `POST /api/market-sentiment`

## Structure

- `src/config` - runtime config/env
- `src/routes` - HTTP route handlers
- `src/services` - business logic and external API calls
- `src/middleware` - rate limiting, request logging, and error handlers

## Required Environment Variables

- `FINNHUB_API_KEY` or `FINNHUB_API_KEYS`
- `TWELVE_DATA_API_KEY` (for candle fallback)
- `ALPHA_VANTAGE_API_KEY` (for candle fallback)
