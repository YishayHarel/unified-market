-- Shared cache for company fundamentals.
--
-- get-stock-fundamentals makes five Finnhub calls per request and cached
-- nothing, which made it by far the most expensive endpoint on the site:
-- Finnhub's free tier allows sixty calls a minute across the whole project, so
-- twelve people opening a stock page in the same minute exhausted the entire
-- budget for every other feature.
--
-- An in-memory cache inside the function is not enough. Edge functions run
-- across isolates and each keeps its own copy, so the hit rate depends on which
-- instance happens to serve the request. A table is shared by all of them.

create table if not exists public.fundamentals_cache (
  symbol text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

comment on table public.fundamentals_cache is
  'Finnhub company fundamentals, cached so page views do not each cost five provider calls.';

create index if not exists fundamentals_cache_fetched_at_idx
  on public.fundamentals_cache (fetched_at);

alter table public.fundamentals_cache enable row level security;

-- Readable by anyone: this is public market data, and the stock page shows it
-- to signed-out visitors. Writes are left to the service role, which has no
-- policy and therefore bypasses RLS.
drop policy if exists "Fundamentals cache is public" on public.fundamentals_cache;
create policy "Fundamentals cache is public"
  on public.fundamentals_cache for select
  using (true);

-- Keeps the table from growing without bound as the symbol universe is browsed.
create or replace function public.prune_fundamentals_cache()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.fundamentals_cache
   where fetched_at < now() - interval '2 days';
$$;
