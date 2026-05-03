alter table public.place_lookup_cache
  drop constraint if exists cache_provider_check;
alter table public.place_lookup_cache
  add constraint cache_provider_check
  check (provider in ('recollect', 'nyc-dsny', 'recollect-ical', 'hoboken-static', 'jersey-city', 'recyclecoach'));
