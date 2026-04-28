begin;
select plan(10);

-- Create two test users
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', 'user_a@test.com', 'x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'user_b@test.com', 'x', now(), now(), now());

-- Insert preferences for user_a via service role (RLS not active for service role)
insert into public.user_preferences(user_id, street, city, state, timezone)
  values ('00000000-0000-0000-0000-000000000001', '123 Main', 'Springfield', 'NY', 'America/New_York');

insert into public.notification_log(user_id, event_type, status)
  values ('00000000-0000-0000-0000-000000000001', 'garbage', 'sent');

-- ── Authenticate as user_a ──────────────────────────────────────────
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  'select count(*)::int from public.user_preferences',
  array[1],
  'user_a sees own preferences'
);

select results_eq(
  'select count(*)::int from public.notification_log',
  array[1],
  'user_a can read own notification_log'
);

select throws_ok(
  $$insert into public.notification_log(user_id, event_type, status)
    values ('00000000-0000-0000-0000-000000000001', 'garbage', 'sent')$$,
  'new row violates row-level security policy for table "notification_log"',
  'user_a cannot insert into notification_log'
);

-- RLS with only SELECT policy causes DELETE to silently affect 0 rows (no exception)
select results_eq(
  $$
    with d as (
      delete from public.notification_log
      where user_id = '00000000-0000-0000-0000-000000000001'
      returning user_id
    ) select count(*)::int from d
  $$,
  array[0],
  'user_a delete from notification_log affects 0 rows (silently blocked)'
);

select results_eq(
  'select count(*)::int from public.pickup_events',
  array[0],
  'user_a sees no pickup_events (none inserted)'
);

-- ── Authenticate as user_b ──────────────────────────────────────────
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

select results_eq(
  'select count(*)::int from public.user_preferences',
  array[0],
  'user_b cannot see user_a preferences'
);

select results_eq(
  'select count(*)::int from public.notification_log',
  array[0],
  'user_b cannot see user_a notification_log'
);

-- ── place_lookup_cache: anyone can read ────────────────────────────
-- Reset to service role to insert (only service role can write cache)
set local role postgres;
insert into public.place_lookup_cache
  (address_key, recollect_place_id, latitude, longitude, timezone, supported_event_types)
  values ('test|cache|ny', 'place-1', 40.7, -74.0, 'America/New_York', '{garbage}');

-- Switch to anon role
set local role anon;
set local "request.jwt.claims" = '{}';

select results_eq(
  'select count(*)::int from public.place_lookup_cache',
  array[1],
  'anonymous user can read place_lookup_cache'
);

select throws_ok(
  $$insert into public.place_lookup_cache
    (address_key, recollect_place_id, latitude, longitude, timezone, supported_event_types)
    values ('x', 'y', 0, 0, 'UTC', '{}')$$,
  'new row violates row-level security policy for table "place_lookup_cache"',
  'anonymous user cannot write to place_lookup_cache'
);

-- rate_limits: no access for any non-service-role user
select throws_ok(
  $$select * from public.rate_limits$$,
  'permission denied for table rate_limits',
  'non-service-role cannot read rate_limits'
);

select * from finish();
rollback;
