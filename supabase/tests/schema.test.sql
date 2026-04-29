begin;
select plan(26);

-- Tables exist
select has_table('public', 'user_preferences',    'user_preferences table exists');
select has_table('public', 'push_tokens',          'push_tokens table exists');
select has_table('public', 'pickup_events',        'pickup_events table exists');
select has_table('public', 'manual_schedules',     'manual_schedules table exists');
select has_table('public', 'notification_log',     'notification_log table exists');
select has_table('public', 'place_lookup_cache',   'place_lookup_cache table exists');
select has_table('public', 'rate_limits',          'rate_limits table exists');

-- user_preferences columns
select has_column('public', 'user_preferences', 'user_id',               'user_preferences.user_id');
select has_column('public', 'user_preferences', 'notify_at',             'user_preferences.notify_at');
select has_column('public', 'user_preferences', 'supported_event_types', 'user_preferences.supported_event_types');

-- manual_schedules: check constraint on frequency
select col_has_check('public', 'manual_schedules', 'frequency', 'manual_schedules.frequency has check constraint');
select col_has_check('public', 'manual_schedules', 'pickup_day', 'manual_schedules.pickup_day has check constraint');
select col_has_check('public', 'manual_schedules', 'event_type', 'manual_schedules.event_type has check constraint');

-- biweekly anchor_date constraint exists
select ok(
  exists(
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'manual_schedules'
      and constraint_name = 'biweekly_requires_anchor'
      and constraint_type = 'CHECK'
  ),
  'biweekly requires anchor_date'
);

-- notification_log: check on status
select col_has_check('public', 'notification_log', 'status', 'notification_log.status has check');

-- pickup_events unique constraint
select has_unique('public', 'pickup_events', 'pickup_events has unique constraint');

-- FKs with ON DELETE CASCADE
select fk_ok('public', 'user_preferences', 'user_id', 'auth', 'users', 'id');
select fk_ok('public', 'push_tokens',      'user_id', 'auth', 'users', 'id');
select fk_ok('public', 'pickup_events',    'user_id', 'auth', 'users', 'id');
select fk_ok('public', 'manual_schedules', 'user_id', 'auth', 'users', 'id');
select fk_ok('public', 'notification_log', 'user_id', 'auth', 'users', 'id');

-- increment_rate_limit function exists
select has_function('public', 'increment_rate_limit', 'increment_rate_limit function exists');

select has_column('public', 'place_lookup_cache', 'provider',      'place_lookup_cache.provider');
select has_column('public', 'place_lookup_cache', 'provider_data', 'place_lookup_cache.provider_data');
select has_column('public', 'user_preferences',   'provider',      'user_preferences.provider');
select has_column('public', 'user_preferences',   'ical_url',      'user_preferences.ical_url');

select * from finish();
rollback;
