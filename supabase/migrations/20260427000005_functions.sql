-- supabase/migrations/20260427000005_functions.sql

create or replace function public.recompute_all_notify_at()
returns int language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  update public.user_preferences
  set notify_at = (
    current_date::timestamp + notification_time
  ) at time zone timezone
  where timezone is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
