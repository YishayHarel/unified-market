-- Month-to-date AI usage accounting.
--
-- The pricing page sells AI calls per month (100 / 200 / 1000 by tier), but the
-- only check in place was a flat 20 per day for every subscriber regardless of
-- what they bought. That over-served the cheap tiers by roughly six times and
-- under-served the most expensive one, which advertises 1000 a month and would
-- have been capped near 600.
--
-- Counting by calendar month matches what is actually sold.

create or replace function public.check_ai_usage_monthly(
  p_user_id uuid,
  p_monthly_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  -- Count first, so a caller already at the limit is not charged for the
  -- request that gets refused.
  select coalesce(sum(call_count), 0)
    into used
    from public.ai_usage
   where user_id = p_user_id
     and usage_date >= date_trunc('month', current_date)::date;

  if used >= p_monthly_limit then
    return jsonb_build_object(
      'allowed', false,
      'used', used,
      'limit', p_monthly_limit
    );
  end if;

  insert into public.ai_usage (user_id, usage_date, call_count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update set call_count = public.ai_usage.call_count + 1;

  return jsonb_build_object(
    'allowed', true,
    'used', used + 1,
    'limit', p_monthly_limit
  );
end;
$$;

comment on function public.check_ai_usage_monthly is
  'Counts a user''s AI calls for the current calendar month and records one more if they are under their tier limit. Returns allowed/used/limit so callers can tell the user where they stand.';
