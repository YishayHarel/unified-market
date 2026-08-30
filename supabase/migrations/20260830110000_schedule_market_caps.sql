-- Schedules the market cap backfill.
--
-- Every ten minutes. A run takes about two minutes and covers 100 symbols, so
-- the ~650 companies with earnings in the next 45 days are filled in within a
-- couple of hours, after which each run finds almost nothing to do and exits
-- immediately.
--
-- Secret from Vault, as with check-alerts.

select cron.schedule(
  'update-market-caps-every-10m',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://bfhdtmxmlcfyxjgracbz.supabase.co/functions/v1/update-market-caps',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1),
        ''
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );
  $$
);
