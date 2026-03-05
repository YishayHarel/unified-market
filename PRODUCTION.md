# Production checklist

## 1. Supabase (Authentication)

- **URL configuration:** Project → Authentication → URL configuration  
  - **Site URL:** `https://unified-market.vercel.app` (or your production domain)  
  - **Redirect URLs:** Add `https://unified-market.vercel.app/**` and your domain if different  

- **SMTP:** Already using Resend. For production sender, add your domain in Resend and set the sender in Supabase to e.g. `noreply@yourdomain.com`.

## 2. Resend

- **Domain:** Resend dashboard → Domains → Add domain, add the DNS records they give you.  
- **Sender:** In Supabase SMTP, set **Sender email** to an address on that domain (e.g. `noreply@yourdomain.com`). You don’t need to create an inbox.

## 3. Vercel

- **Env vars:** Project → Settings → Environment Variables. Set for **Production** (and Preview if you want):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Redeploy after changing env vars (or push a commit).

## 4. Multiple API keys (rate limits)

You can add several keys per provider so the app round-robins and spreads rate limits.

**Supabase** → Project → Settings → Edge Functions → Secrets (or env):

- **Finnhub:** set `FINNHUB_API_KEYS` = `key1,key2,key3` (comma-separated, no spaces). Or keep a single `FINNHUB_API_KEY`.
- **Alpha Vantage:** set `ALPHA_VANTAGE_API_KEYS` = `key1,key2,key3`. Or keep `ALPHA_VANTAGE_API_KEY`.
- **Twelve Data:** set `TWELVE_DATA_API_KEYS` = `key1,key2`. Or keep `TWELVE_DATA_API_KEY`.

Used in: stock prices, news, fundamentals, treasury/VIX, candles (where applicable). Each request or batch uses the next key in rotation.

**Note:** Many free tiers allow one account per app. Check each provider’s terms before creating extra accounts.

## 5. Code

- Debug code removed: no `window.supabaseClient`, no auth console logs in production build.
- CORS in Edge Functions already allows `https://unified-market.vercel.app` and `*.vercel.app`.
