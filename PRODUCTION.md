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

## 4. Code

- Debug code removed: no `window.supabaseClient`, no auth console logs in production build.
- CORS in Edge Functions already allows `https://unified-market.vercel.app` and `*.vercel.app`.
