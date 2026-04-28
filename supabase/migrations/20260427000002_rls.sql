alter table public.user_preferences    enable row level security;
alter table public.push_tokens         enable row level security;
alter table public.pickup_events       enable row level security;
alter table public.manual_schedules    enable row level security;
alter table public.notification_log    enable row level security;
alter table public.place_lookup_cache  enable row level security;
alter table public.rate_limits         enable row level security;

-- user_preferences: full CRUD for own row
create policy "users_own_preferences" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- push_tokens: full CRUD for own row
create policy "users_own_push_tokens" on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- pickup_events: read own rows only (service role inserts/deletes)
create policy "users_read_own_events" on public.pickup_events
  for select using (auth.uid() = user_id);

-- manual_schedules: full CRUD for own rows
create policy "users_own_manual_schedules" on public.manual_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- notification_log: read-only for own rows; service role handles writes
create policy "users_read_own_logs" on public.notification_log
  for select using (auth.uid() = user_id);

-- place_lookup_cache: read for all, writes via service role only
create policy "anyone_read_cache" on public.place_lookup_cache
  for select using (true);

-- rate_limits: no end-user access — revoke default grants so SELECT throws permission denied
revoke all on public.rate_limits from anon, authenticated;
