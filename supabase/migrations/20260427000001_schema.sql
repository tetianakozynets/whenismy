create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- user_preferences
create table public.user_preferences (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  street                   text not null,
  city                     text not null,
  state                    char(2) not null,
  recollect_place_id       text,
  latitude                 numeric(9,6),
  longitude                numeric(9,6),
  timezone                 text not null default 'America/New_York',
  notification_time        time not null default '20:00',
  notify_at                timestamptz,
  notifications_garbage    boolean not null default true,
  notifications_recycling  boolean not null default true,
  notifications_yard_waste boolean not null default false,
  supported_event_types    text[] not null default '{}',
  updated_at               timestamptz not null default now()
);

-- push_tokens (separate table — tokens never exposed via SELECT * on user_preferences)
create table public.push_tokens (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  expo_push_token  text,
  updated_at       timestamptz not null default now()
);

-- pickup_events
create table public.pickup_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  event_date   date not null,
  event_type   text not null,
  source       text not null check (source in ('recollect', 'manual')),
  refreshed_at timestamptz not null default now(),
  unique (user_id, event_date, event_type, source)
);

-- manual_schedules
create table public.manual_schedules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_type  text not null check (event_type in ('garbage', 'recycling', 'yard_waste')),
  pickup_day  text not null check (pickup_day in (
                 'monday','tuesday','wednesday','thursday','friday','saturday','sunday'
               )),
  frequency   text not null check (frequency in ('weekly', 'biweekly')),
  anchor_date date,
  active      boolean not null default true,
  constraint biweekly_requires_anchor check (frequency != 'biweekly' or anchor_date is not null)
);

-- notification_log
create table public.notification_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  event_type      text not null,
  sent_at         timestamptz not null default now(),
  status          text not null check (status in ('sent', 'failed', 'delivered', 'receipt_error')),
  expo_ticket_id  text
);

-- place_lookup_cache
create table public.place_lookup_cache (
  address_key          text primary key,
  recollect_place_id   text not null,
  latitude             numeric(9,6) not null,
  longitude            numeric(9,6) not null,
  timezone             text not null,
  supported_event_types text[] not null,
  cached_at            timestamptz not null default now()
);

-- rate_limits
create table public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        int not null default 1,
  primary key (key, window_start)
);

-- Rate limit increment function (atomic upsert, used by Edge Functions)
create or replace function public.increment_rate_limit(p_key text, p_window timestamptz)
returns int language plpgsql security definer as $$
declare
  v_count int;
begin
  insert into public.rate_limits(key, window_start, count)
    values (p_key, p_window, 1)
    on conflict (key, window_start)
    do update set count = rate_limits.count + 1
    returning count into v_count;
  return v_count;
end;
$$;
