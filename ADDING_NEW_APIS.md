# How to Safely Add New APIs

## 🔒 Security Best Practices

**NEVER share your actual API keys in chat or commit them to git!**

Here's how we work together safely:

### 1. **Tell Me What API You Want to Add**
Just tell me:
- Which API service (e.g., "I want to add Alpha Vantage for options data")
- What feature you want to build with it
- Any specific endpoints you need

### 2. **I'll Write the Code**
I'll:
- Create the Edge Function code
- Use `Deno.env.get('YOUR_API_KEY_NAME')` to read the key
- Add proper error handling
- Set up rate limiting
- Configure CORS

### 3. **You Add the Key Securely**
You add the actual API key value in:
- **Supabase Dashboard** → Your Project → Edge Functions → Settings → Secrets
- Or **Vercel Dashboard** → Your Project → Settings → Environment Variables

### 4. **Example: Adding a New API**

**What you tell me:**
> "I want to add NewsAPI for better news coverage"

**What I'll do:**
1. Create/update Edge Function code:
```typescript
const newsApiKey = Deno.env.get('NEWS_API_KEY');
if (!newsApiKey) {
  throw new Error('NEWS_API_KEY not configured');
}
```

2. Show you where to add it:
   - Go to Supabase Dashboard
   - Edge Functions → Settings → Secrets
   - Add: `NEWS_API_KEY` = `your_actual_key_here`

**What you do:**
- Add the key in Supabase/Vercel dashboard (never in code!)
- Deploy the function
- Test it

---

## 📋 Current APIs in Your Project

Based on your code, you're using:

1. **Finnhub API** (`FINNHUB_API_KEY`)
   - Used for: Stock prices, news, fundamentals
   - Location: Multiple Edge Functions

2. **OpenAI API** (`OPENAI_API_KEY`)
   - Used for: AI features (stock advisor, portfolio optimizer, etc.)
   - Location: AI Edge Functions

3. **Twelve Data API** (`TWELVE_DATA_API_KEY`)
   - Used for: Alternative stock data source
   - Location: `get-stock-candles`, `smart-alerts`

4. **Alpha Vantage API** (`ALPHA_VANTAGE_API_KEY`)
   - Used for: Treasury yields, VIX data, technical indicators
   - Location: `get-treasury-vix`, `get-stock-candles`

5. **Stripe API** (`STRIPE_SECRET_KEY`)
   - Used for: Payment processing
   - Location: `create-checkout`, `check-subscription`, `customer-portal`

6. **Resend API** (`RESEND_API_KEY`)
   - Used for: Email sending
   - Location: `send-email`

---

## ✅ Safe Workflow

1. **You:** "I want to add [API name] for [feature]"
2. **Me:** I write the code using environment variables
3. **You:** Add the key in Supabase/Vercel dashboard
4. **Me:** Help you test and debug (without seeing the key)
5. **You:** Deploy and enjoy!

---

## 🚨 Never Do This

❌ Don't paste API keys in chat
❌ Don't commit keys to git
❌ Don't hardcode keys in code
❌ Don't share keys in screenshots

✅ Do use environment variables
✅ Do add keys in dashboard only
✅ Do test with placeholder values first
✅ Do use different keys for dev/prod

---

**Your secrets stay secret! I only see the code structure, not the actual values.** 🔐
