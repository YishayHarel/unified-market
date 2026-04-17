# 📈 UnifiedMarket

A full-stack financial market platform with AI-powered insights, real-time stock tracking, and social investing features.

Built with React, TypeScript, and Supabase.

## Features

- **Real-time Stock Tracking** - Live prices, interactive charts, and market data via Finnhub API
- **AI Stock Advisor** - Personalized investment recommendations using OpenAI and Google Gemini
- **Smart News Summarizer** - Financial news with AI-generated summaries
- **Portfolio Management** - Track holdings, dividends, and optimize asset allocation
- **Social Investing** - Share picks, follow investors, and track prediction accuracy
- **Earnings Calendar & Alerts** - Never miss important market events
- **Fully Responsive** - Works on desktop, tablet, and mobile

## Tech Stack

### Frontend
- React 18.3 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui components
- React Router 6
- TanStack Query (data fetching)
- Recharts (data visualization)

### Backend
- Supabase (PostgreSQL database, authentication, Row-Level Security)
- Edge Functions (Deno runtime for serverless API)
- Express API (`server/`) for modular backend routes and migration off edge functions
- Express routes migrated so far: `POST /api/stock-prices`, `POST /api/news`, `POST /api/stock-candles`, `POST /api/stock-fundamentals`, `POST /api/market-sentiment`
- OpenAI API & Google Gemini API (AI features)
- Finnhub API (market data)
- News API (financial news)

## Getting Started

### Prerequisites

Node.js 18+ is required. Install via [nvm](https://github.com/nvm-sh/nvm) (recommended) or [nodejs.org](https://nodejs.org/).

### Installation

```bash
# Clone the repository
git clone https://github.com/YourUsername/UnifiedMarket.git
cd UnifiedMarket

# Install frontend dependencies
npm install

# Install Express backend dependencies
npm --prefix server install

# Start frontend development server
npm run dev

# In a second terminal, start backend server
npm run dev:server
```

The app will be available at `http://localhost:8080` and backend API at `http://localhost:4000`.

### Build for Production

```bash
npm run build    # Create optimized build
npm run preview  # Preview production build locally
```

## Project Structure

Architecture and external API notes: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/EXTERNAL_APIS.md](docs/EXTERNAL_APIS.md).

```
UnifiedMarket/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/              # shadcn/ui base components
│   │   ├── AIStockAdvisor.tsx
│   │   ├── StockChart.tsx
│   │   ├── TopMovers.tsx
│   │   └── ...
│   ├── pages/               # Route-level page components
│   │   ├── Index.tsx        # Home page
│   │   ├── StockDetail.tsx  # Individual stock view
│   │   ├── Auth.tsx         # Login/signup
│   │   └── ...
│   ├── hooks/               # Custom React hooks
│   ├── contexts/            # React Context providers
│   ├── integrations/        # Third-party integrations (Supabase)
│   ├── lib/                 # Utility functions
│   └── index.css            # Global styles & design tokens
├── supabase/
│   ├── functions/           # Edge Functions (serverless API)
│   │   ├── get-stock-prices/
│   │   ├── ai-stock-advisor/
│   │   ├── get-earnings/
│   │   └── ...
│   └── config.toml          # Supabase configuration
├── server/
│   ├── src/
│   │   ├── config/          # Env + app config
│   │   ├── routes/          # Express route modules
│   │   ├── services/        # Backend business logic modules
│   │   └── middleware/      # API middleware (rate limits, auth, etc.)
│   └── .env.example
└── public/                  # Static assets
```

## Database Schema

The app uses 9 PostgreSQL tables with Row-Level Security:

| Table | Purpose |
|-------|---------|
| `stocks` | Stock symbols, names, market caps, rankings |
| `profiles` | User display names and avatars |
| `user_saved_stocks` | User's watchlist/saved stocks |
| `watchlist_alerts` | Price and event alerts |
| `user_dividends` | Dividend tracking for holdings |
| `portfolio_holdings` | User's stock positions |
| `user_preferences` | Risk tolerance, investment goals |
| `social_picks` | Shared investment picks (buy/sell/hold) |
| `social_follows` | User follow relationships |

## Edge Functions

| Function | Purpose |
|----------|---------|
| `get-stock-prices` | Fetch real-time prices from Finnhub |
| `get-stock-fundamentals` | Get P/E ratio, market cap, etc. |
| `get-earnings` | Earnings calendar data |
| `get-news` | Financial news from News API |
| `ai-stock-advisor` | AI-powered stock recommendations |
| `ai-portfolio-optimizer` | Portfolio optimization suggestions |
| `smart-news-summarizer` | AI news summaries |
| `market-sentiment` | Fear & Greed index, market health |
| `update-top-100` | Recalculate top 100 stock rankings |

## Environment Variables

Required secrets (configured in Supabase):

- `FINNHUB_API_KEY` - Stock market data
- `NEWS_API_KEY` - Financial news
- `OPENAI_API_KEY` - AI features
- `GOOGLE_GEMINI_API_KEY` - Alternative AI model

Frontend/runtime variables:

- `VITE_BACKEND_URL` - Express backend URL (defaults to `http://localhost:4000`)

Express backend variables (see `server/.env.example`):

- `PORT` - API port
- `CORS_ORIGIN` - Allowed frontend origin(s)
- `FINNHUB_API_KEY` or `FINNHUB_API_KEYS` - Market data key(s)
- `TWELVE_DATA_API_KEY` - Candle fallback provider
- `ALPHA_VANTAGE_API_KEY` - Candle fallback provider

## Security

- Row-Level Security (RLS) on all user data tables
- JWT-based authentication via Supabase Auth
- API keys stored as encrypted environment variables
- User data isolated at the database level

## Scripts

```bash
npm run dev      # Start development server
npm run dev:server # Start Express backend server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Production Rollout Checklist

1. Deploy Supabase Edge Functions:
   - `get-stock-prices`
   - `get-stock-candles`
   - `get-treasury-vix`
2. Set Supabase secrets:
   - `FRED_API_KEY` (recommended for VIX + Treasury)
   - `FINNHUB_API_KEY` or `FINNHUB_API_KEYS`
   - Optional: `TWELVE_DATA_API_KEYS`, `ALPHA_VANTAGE_API_KEYS`
3. Deploy Express backend (`server/`) to your host (Render/Railway/Fly).
4. Set `VITE_BACKEND_URL` in Vercel to your backend URL.
5. Ensure backend origin is allowed by CORS (`CORS_ORIGIN`) and frontend CSP (`vercel.json` connect-src).
6. Run smoke test after deploy:
   - Prices load on stock detail page
   - Candles load for 1D/1M
   - VIX + 2Y + 10Y load in dashboard
   - No persistent 429/500 errors in browser console or function logs

## License

MIT License
