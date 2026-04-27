-- All cron jobs call Edge Functions via net.http_post.

-- Notification sender: every 30 minutes
select cron.schedule(
  'send-notifications',
  '*/30 * * * *',
  $$select net.http_post(
      url := current_setting('app.edge_function_base') || '/send-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    )$$
);

-- Schedule refresh: every 30 minutes (staggered logic inside the function)
select cron.schedule(
  'refresh-schedules',
  '*/30 * * * *',
  $$select net.http_post(
      url := current_setting('app.edge_function_base') || '/refresh-schedules',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    )$$
);

-- notify_at recompute: daily at 00:05 UTC
select cron.schedule(
  'recompute-notify-at',
  '5 0 * * *',
  $$select net.http_post(
      url := current_setting('app.edge_function_base') || '/recompute-notify-at',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    )$$
);

-- notification_log retention: monthly, delete rows older than 90 days
select cron.schedule(
  'purge-notification-log',
  '0 3 1 * *',
  $$delete from public.notification_log where sent_at < now() - interval '90 days'$$
);

-- place_lookup_cache expiry: hourly, delete entries older than 24h
select cron.schedule(
  'purge-place-cache',
  '0 * * * *',
  $$delete from public.place_lookup_cache where cached_at < now() - interval '24 hours'$$
);

-- rate_limits cleanup: daily, delete windows older than 2 days
select cron.schedule(
  'purge-rate-limits',
  '0 4 * * *',
  $$delete from public.rate_limits where window_start < now() - interval '2 days'$$
);

-- App config placeholders (update with real values via Supabase dashboard before first deploy)
alter database postgres set "app.edge_function_base" = 'https://your-project.supabase.co/functions/v1';
alter database postgres set "app.service_role_key" = 'your-service-role-key';
