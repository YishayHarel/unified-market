# How to Deploy Edge Functions to Fix News

## 🚨 Important: Edge Functions Must Be Deployed Separately

The code changes I made are **local only**. You need to deploy the `get-news` Edge Function to Supabase for the fixes to take effect.

## Option 1: Deploy via Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard
   - Select your project: `bfhdtmxmlcfyxjgracbz`

2. **Navigate to Edge Functions:**
   - Click "Edge Functions" in the left sidebar
   - Find `get-news` in the list

3. **Deploy the Function:**
   - Click on `get-news`
   - Click "Deploy" or "Update"
   - Copy the updated code from `supabase/functions/get-news/index.ts`
   - Paste it into the editor
   - Click "Deploy"

## Option 2: Deploy via Supabase CLI (Recommended)

If you have Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref bfhdtmxmlcfyxjgracbz

# Deploy the get-news function
supabase functions deploy get-news
```

## Option 3: Check API Key Configuration

The error might also be because `FINNHUB_API_KEY` is not set in Supabase:

1. **Go to Supabase Dashboard**
2. **Edge Functions → Settings → Secrets**
3. **Check if `FINNHUB_API_KEY` exists:**
   - If missing, add it with your Finnhub API key value
   - If it exists, verify it's correct

## Quick Test

After deploying, test the function:
- Visit your site: https://unified-market.vercel.app/
- Check the news section
- Open browser console (F12) to see any errors

## What I Fixed

1. ✅ Added Vercel domain to CORS allowed origins
2. ✅ Updated get-news to use shared CORS utility
3. ✅ Improved error handling

The fixes are in the code - they just need to be deployed to Supabase!
