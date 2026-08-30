-- Schedules the price alert checker.
--
-- check-alerts has existed since the alerts screen was built and nothing ever
-- invoked it, so every alert anyone set sat there permanently unevaluated. The
-- function is now a cron job over all users; this is what makes it run.
--
-- Every 15 minutes on weekdays between 13:00 and 21:59 UTC, which covers the
-- US session including the pre-open and the close. Outside those hours prices
-- do not move, so checking would only burn invocations.
--
-- The shared secret is read from Vault rather than written into the job body,
-- where it would end up in this file and in cron.job for anyone with database
-- access to read. Store it once per environment with:
--
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
--
-- If the secret is absent the job posts an empty header and the function
-- answers 401, which is the right way for a missing secret to fail.

select cron.schedule(
  'check-alerts-market-hours',
  '*/15 13-21 * * 1-5',
  $$
  select net.http_post(
    url := 'https://bfhdtmxmlcfyxjgracbz.supabase.co/functions/v1/check-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1),
        ''
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
