-- Cached market news.
--
-- News was fetched live from six publisher RSS feeds on every page load, so
-- traffic to those publishers scaled with our visitors and the same articles
-- were parsed over and over. Ingesting on a schedule into this table decouples
-- publisher load from user count and, more importantly, gives us articles as
-- data: taggable by ticker, rankable, searchable, and joinable to a user's
-- watchlist.

create table if not exists public.news_articles (
  id bigint generated always as identity primary key,
  -- Natural key. Query strings differ between feeds for the same story, so the
  -- ingest strips them before writing.
  url text not null unique,
  title text not null,
  description text,
  source text not null,
  image_url text,
  published_at timestamptz not null,
  -- Symbols mentioned in the headline or summary; empty when nothing matched.
  tickers text[] not null default '{}',
  fetched_at timestamptz not null default now()
);

-- The feed is always read newest-first.
create index if not exists news_articles_published_at_idx
  on public.news_articles (published_at desc);

-- Supports `tickers && array['AAPL']` for per-symbol and watchlist queries.
create index if not exists news_articles_tickers_idx
  on public.news_articles using gin (tickers);

alter table public.news_articles enable row level security;

-- Headlines are public content; anyone may read them. Writes happen only from
-- the ingest function, which uses the service role and bypasses RLS.
drop policy if exists "News articles are publicly readable" on public.news_articles;
create policy "News articles are publicly readable"
  on public.news_articles
  for select
  using (true);

-- Bull/Bear tallies alongside each article.
--
-- security_invoker keeps the caller's RLS in force rather than the view
-- owner's, so this cannot become a way to read news_sentiment rows a user
-- would otherwise be denied.
drop view if exists public.news_articles_with_sentiment;
create view public.news_articles_with_sentiment
with (security_invoker = on) as
select
  a.id,
  a.url,
  a.title,
  a.description,
  a.source,
  a.image_url,
  a.published_at,
  a.tickers,
  a.fetched_at,
  coalesce(s.bull_count, 0) as bull_count,
  coalesce(s.bear_count, 0) as bear_count
from public.news_articles a
left join (
  select
    news_url,
    count(*) filter (where sentiment = 'bull') as bull_count,
    count(*) filter (where sentiment = 'bear') as bear_count
  from public.news_sentiment
  group by news_url
) s on s.news_url = a.url;

-- Keeps the table bounded. Headlines older than two weeks have no value here
-- and the free tier's storage is worth protecting.
create or replace function public.prune_old_news_articles()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.news_articles
  where published_at < now() - interval '14 days';
$$;
