-- Notification cron query: find users whose notify_at is in the past 30 min
create index idx_user_preferences_notify_at
  on public.user_preferences (notify_at)
  where notify_at is not null;

-- Cron query joins pickup_events on (user_id, event_date)
create index idx_pickup_events_user_date
  on public.pickup_events (user_id, event_date);

-- Dedup check in notification cron
create index idx_notification_log_user_type_sent
  on public.notification_log (user_id, event_type, sent_at);

-- Active manual schedules
create index idx_manual_schedules_user_active
  on public.manual_schedules (user_id)
  where active = true;

-- Cache expiry cleanup
create index idx_place_lookup_cache_cached_at
  on public.place_lookup_cache (cached_at);
