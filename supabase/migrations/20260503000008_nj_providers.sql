alter table public.place_lookup_cache
  drop constraint if exists cache_provider_check;
alter table public.place_lookup_cache
  add constraint cache_provider_check
  check (provider in ('recollect', 'nyc-dsny', 'recollect-ical', 'hoboken-static', 'jersey-city', 'recyclecoach'));

alter table public.user_preferences
  drop constraint if exists prefs_provider_check;
alter table public.user_preferences
  add constraint prefs_provider_check
  check (provider in ('recollect', 'nyc-dsny', 'recollect-ical', 'hoboken-static', 'jersey-city', 'recyclecoach', 'manual') or provider is null);

alter table public.pickup_events
  drop constraint if exists pickup_events_source_check;
alter table public.pickup_events
  add constraint pickup_events_source_check
  check (source in ('recollect', 'manual', 'nyc-dsny', 'recyclecoach', 'jersey-city'));
