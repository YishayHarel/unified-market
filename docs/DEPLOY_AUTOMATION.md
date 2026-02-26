# Auto-deploy setup (Vercel + Supabase)

You can have both **frontend** and **backend** deploy automatically on push—no one-by-one function deploys.

## Frontend (Vercel)

1. In [Vercel Dashboard](https://vercel.com/dashboard), connect this repo if you haven’t already.
2. Vercel will deploy on every push to `main` (and optionally preview deploys on PRs).
3. No extra config needed; your `vercel.json` is already in the repo.

## Backend (Supabase Edge Functions)

A GitHub Actions workflow deploys **all** Edge Functions in one go when you push to `main`.

### One-time setup

1. **Create a Supabase access token**
   - Go to [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens).
   - Create a token and copy it.

2. **Add GitHub secrets**
   - Repo → **Settings** → **Secrets and variables** → **Actions**.
   - New repository secret:
     - **Name:** `SUPABASE_ACCESS_TOKEN`
     - **Value:** the token from step 1.
   - Optional: if your project ref is different, add:
     - **Name:** `SUPABASE_PROJECT_REF`
     - **Value:** your project ref (e.g. `bfhdtmxmlcfyxjgracbz`).  
     If you don’t set this, the workflow uses the ref from `supabase/config.toml`.

### When it runs

- **Automatic:** On push to `main` when files under `supabase/functions/` or `supabase/config.toml` (or the workflow file) change.
- **Manual:** In the **Actions** tab, open “Deploy Supabase Edge Functions” and click **Run workflow**.

### Safety

- Runs only on the `main` branch (or when you trigger it manually).
- Only runs when Supabase-related files change, so unrelated frontend-only changes don’t trigger a functions deploy.
- All function config (e.g. `verify_jwt`) in `supabase/config.toml` is applied on deploy.
- Secrets (e.g. `FINNHUB_API_KEY`) stay in Supabase Dashboard → Edge Functions → Settings → Secrets; the workflow does not touch them.

After setup, push to `main` and both Vercel and Supabase will deploy automatically.

---

## Production polish (recommended)

These steps make production more secure and easier to manage. Your app already works without them (it uses fallbacks in code), but doing this is best practice.

### 1. Set environment variables in Vercel

So production uses config from Vercel instead of values in the repo. You can change or rotate keys without a code change, and it keeps secrets out of the repo.

**Steps:**

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your **unified-market** project.
2. Go to **Settings** → **Environment Variables**.
3. Add (for **Production**, and optionally Preview if you want previews to use the same project):

   | Name | Value |
   |------|--------|
   | `VITE_SUPABASE_URL` | `https://bfhdtmxmlcfyxjgracbz.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon (public) key |

   To get the anon key: Supabase Dashboard → Project Settings → API → **anon public**.

4. Save. Redeploy the project (Deployments → … on latest → Redeploy) so the new env vars are used.

**What this does for your website:** Production builds will use these variables. The site will behave the same if the fallbacks in code match, but you no longer rely on hardcoded values, and you can rotate the anon key in Supabase and update it only in Vercel.

### 2. Local dev (optional)

Copy `.env.example` to `.env` and fill in the same values so local dev uses env vars too. Never commit `.env`.
