-- place_lookup_cache: track which provider served this result
alter table public.place_lookup_cache
  add column if not exists provider        text not null default 'recollect',
  add column if not exists provider_data   jsonb;

-- user_preferences: track provider + store iCal URL for recollect-ical users
alter table public.user_preferences
  add column if not exists provider  text,
  add column if not exists ical_url  text;

-- check constraints to prevent invalid provider values
alter table public.place_lookup_cache
  add constraint cache_provider_check
  check (provider in ('recollect', 'nyc-dsny', 'recollect-ical'));

alter table public.user_preferences
  add constraint prefs_provider_check
  check (provider in ('recollect', 'nyc-dsny', 'recollect-ical', 'manual') or provider is null);

-- extend pickup_events source to accept 'nyc-dsny'
alter table public.pickup_events
  drop constraint if exists pickup_events_source_check;
alter table public.pickup_events
  add constraint pickup_events_source_check
  check (source in ('recollect', 'manual', 'nyc-dsny'));
