-- The original cron.schedule() jobs authenticated to Edge Functions via
-- current_setting('app.service_role_key'), set through `ALTER DATABASE ...
-- SET`. That requires superuser privileges Supabase's hosted `postgres`
-- role does not have (confirmed: fails with 42501 permission denied, and
-- custom app.* GUC parameters aren't supported on hosted projects at all).
-- Every run of these three jobs has been failing silently since deployment.
--
-- Supabase's own guide for this pattern (cron -> Edge Function) stores the
-- auth key in Vault instead. See:
-- https://supabase.com/docs/guides/functions/schedule-functions
--
-- The edge function base URL isn't secret (it's just the project ref, also
-- public in the app's client bundle), so it's inlined directly rather than
-- also going through Vault.

create extension if not exists supabase_vault;

-- NOTE: this migration only wires the jobs to read from Vault. The secret
-- itself is NOT created here — never commit a real secret value to a
-- migration file. Run this once, by hand, in the SQL Editor, with your
-- actual secret key substituted in:
--
--   select vault.create_secret('<your sb_secret_... key>', 'cron_service_role_key');
--
-- If you ever rotate the key, update it with:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'cron_service_role_key'),
--     '<new key>'
--   );

select cron.unschedule('send-notifications');
select cron.unschedule('refresh-schedules');
select cron.unschedule('recompute-notify-at');

select cron.schedule(
  'send-notifications',
  '*/30 * * * *',
  $$select net.http_post(
      url := 'https://uolwkqydokoqcqydunje.supabase.co/functions/v1/send-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'
        )
      ),
      body := '{}'::jsonb
    )$$
);

select cron.schedule(
  'refresh-schedules',
  '*/30 * * * *',
  $$select net.http_post(
      url := 'https://uolwkqydokoqcqydunje.supabase.co/functions/v1/refresh-schedules',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'
        )
      ),
      body := '{}'::jsonb
    )$$
);

select cron.schedule(
  'recompute-notify-at',
  '5 0 * * *',
  $$select net.http_post(
      url := 'https://uolwkqydokoqcqydunje.supabase.co/functions/v1/recompute-notify-at',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'
        )
      ),
      body := '{}'::jsonb
    )$$
);
