-- Tracks when a market cap was last fetched.
--
-- The backfill job needs to know which caps are stale, and stocks.updated_at
-- cannot answer that: update-stock-prices and update-top-100 both stamp it for
-- their own reasons, so a row can look freshly updated while carrying a cap
-- from months ago — or none at all.

alter table public.stocks
  add column if not exists market_cap_updated_at timestamptz;

-- The 60 rows that already had a cap came from update-top-100 and are current.
update public.stocks
   set market_cap_updated_at = coalesce(last_ranked_at, updated_at, now())
 where market_cap is not null
   and market_cap_updated_at is null;

-- The backfill picks targets by "no cap, or a stale one", over a symbol list
-- drawn from the upcoming earnings calendar.
create index if not exists stocks_market_cap_freshness_idx
  on public.stocks (market_cap_updated_at nulls first);
