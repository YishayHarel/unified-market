# 📈 UnifiedMarket

> Your gateway to financial markets, powered by AI-driven insights and real-time data

A comprehensive financial market platform built with modern web technologies. Track stocks, analyze markets, get AI-powered investment recommendations, and manage your portfolio - all in one place.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Cloud-3ECF8E?logo=supabase)

## ✨ Features

- 📊 **Real-time Stock Tracking** - Live prices, charts, and market data
- 🤖 **AI Stock Advisor** - Get personalized investment recommendations powered by OpenAI
- 📰 **Smart News Summarizer** - Aggregated financial news with AI-generated summaries
- 💰 **Dividend Tracker** - Monitor dividend income and payment schedules
- 📅 **Earnings Calendar** - Never miss important earnings announcements
- 📈 **Portfolio Management** - Track your holdings and optimize allocation
- 👥 **Social Features** - Share investment picks and follow other investors
- 🔔 **Custom Alerts** - Set price alerts and get notified of market movements
- 📱 **Fully Responsive** - Beautiful UI that works on desktop, tablet, and mobile

## 🚀 Tech Stack

### Frontend
- **React 18.3.1** - Component-based UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Lightning-fast build tool and dev server
- **Tailwind CSS** - Utility-first styling framework
- **shadcn/ui** - Accessible component library built on Radix UI
- **React Router 6** - Client-side routing
- **TanStack Query** - Powerful server state management
- **Recharts** - React charting library

### Backend (Lovable Cloud / Supabase)
- **PostgreSQL** - Relational database with Row-Level Security
- **Supabase Auth** - Email/password and Google OAuth authentication
- **Edge Functions** - Serverless API endpoints (Deno runtime)
- **Real-time** - Live data synchronization

### External APIs
- **OpenAI API** - AI-powered stock analysis and recommendations
- **Google Gemini API** - Alternative AI model for certain features
- **Finnhub API** - Real-time stock prices and market data
- **News API** - Financial news aggregation

### Deployment
- **Vercel** - Production hosting with automatic deployments
- **GitHub** - Version control and CI/CD

## 📦 Getting Started

### Prerequisites

You need **Node.js 18+** installed on your machine:
- [Install Node.js with nvm](https://github.com/nvm-sh/nvm#installing-and-updating) (recommended)
- Or [download from nodejs.org](https://nodejs.org/)

### Installation

```bash
# Clone the repository
git clone https://github.com/YourUsername/UnifiedMarket.git

# Navigate to project directory
cd UnifiedMarket

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:8080`

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_PROJECT_ID="your_project_id"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your_anon_key"
```

### Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

## 📁 Project Structure

```
UnifiedMarket/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── AIStockAdvisor.tsx
│   │   ├── StockChart.tsx
│   │   └── ...
│   ├── pages/              # Route-level page components
│   │   ├── Index.tsx       # Home page
│   │   ├── StockDetail.tsx # Individual stock view
│   │   ├── Auth.tsx        # Login/signup
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   │   ├── useAnalytics.ts
│   │   └── useErrorTracking.ts
│   ├── contexts/           # React Context providers
│   │   └── AuthContext.tsx
│   ├── integrations/       # Third-party integrations
│   │   └── supabase/       # Supabase client & types
│   ├── lib/                # Utility functions
│   └── index.css           # Global styles & design tokens
├── supabase/
│   ├── functions/          # Edge Functions (serverless API)
│   │   ├── get-stock-prices/
│   │   ├── ai-stock-advisor/
│   │   └── ...
│   └── config.toml         # Supabase configuration
├── public/                 # Static assets
├── vercel.json            # Vercel deployment config
└── package.json           # Dependencies & scripts
```

## 🛠️ Available Scripts

```bash
npm run dev      # Start development server (port 8080)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## 🎨 Design System

The app uses a custom design system with semantic color tokens defined in `src/index.css`:
- All colors are HSL-based for easy theming
- Supports light/dark mode
- Customized shadcn/ui components with consistent variants

## 🔐 Security

- **Row-Level Security (RLS)** on all database tables
- User data is isolated and protected at the database level
- Authentication via Supabase Auth with JWT tokens
- API keys stored securely as environment variables

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Set Framework Preset to **"Vite"**
4. Add environment variables
5. Deploy!

The `vercel.json` configuration is already set up for proper SPA routing.

## 📝 Key Features Explained

### AI Stock Advisor
Powered by OpenAI, provides personalized investment recommendations based on your portfolio, risk tolerance, and market conditions.

### Portfolio Optimizer
Uses AI to analyze your holdings and suggest optimal allocation across sectors and asset types.

### Smart News Summarizer
Aggregates financial news from multiple sources and uses AI to generate concise market summaries.

### Social Features
- Share your investment picks (buy/sell/hold) with reasoning
- Follow other investors and see their picks
- Track your prediction accuracy over time

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🔗 Links

- **Live Demo**: [UnifiedMarket on Vercel](https://your-domain.vercel.app)
- **Lovable Project**: [Edit in Lovable](https://lovable.dev/projects/85a34aed-b2cd-4a8b-8664-ff1b782adf81)
- **Documentation**: [Lovable Docs](https://docs.lovable.dev)

---

Built with ❤️ using [Lovable](https://lovable.dev) - The AI-powered web app builder
