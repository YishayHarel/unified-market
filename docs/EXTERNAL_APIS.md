# External market APIs

## Finnhub

- Used for: real-time **quotes**, **earnings calendar**, some **news**, **candles** (when allowed by plan).
- Env: `FINNHUB_API_KEY` or comma-separated `FINNHUB_API_KEYS` (rotation).

## Twelve Data

- Used for: **candle fallback**, **batch quote fallback** when Finnhub returns no price, alerts.
- Base URL in code: `https://api.twelvedata.com/`
- Env: `TWELVE_DATA_API_KEY` or `TWELVE_DATA_API_KEYS`.

### Emails about API changes (e.g. “May 16”)

Twelve Data sometimes emails about **pricing**, **credit usage**, **new endpoints**, or **deprecations**. They do **not** always mean your code breaks on that date.

**What to do**

1. Open the email and note whether it says **URL change**, **auth change**, **sunset date**, or **plan/credits** only.
2. Check [Twelve Data status / docs](https://twelvedata.com/docs) and your [dashboard](https://twelvedata.com/account) for API usage and announcements.
3. After any announced breaking change, run `./scripts/prod-smoke-check.sh` against your Supabase project (see script header) and spot-check **quotes** and **charts** in the app.

If the email is only about **billing or credits**, update your plan or keys in Supabase/Render secrets—no code change required.

## Alpha Vantage

- Used for: candle **fallback**, some **ETF** paths, indicator helpers.
- Env: `ALPHA_VANTAGE_API_KEY` or `ALPHA_VANTAGE_API_KEYS`.

## FRED (Federal Reserve)

- Used for: Treasury / macro series where configured (`get-treasury-vix`, etc.).
- Env: `FRED_API_KEY` (recommended name in README checklist).
