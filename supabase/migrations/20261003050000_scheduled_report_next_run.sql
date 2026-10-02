-- When a scheduled report next runs, computed in one place.
--
-- Before, the enqueuer added day_of_week to a Monday-based week (so 0 meant
-- Monday, the default 1 meant Tuesday), let day_of_month 31 spill into the
-- next month, ignored the hour for quarterly/annual schedules, and new
-- schedules simply ran "tomorrow". Now:
--   day_of_week  0 = Sunday … 6 = Saturday (weekly, biweekly)
--   day_of_month 1-31, clamped to the month's last day (monthly, quarterly,
--                annually: the first month of the quarter / January)
--   hour_utc     the hour of day, UTC
create or replace function public.scheduled_report_next_run(
  p_frequency public.schedule_frequency,
  p_day_of_week integer,
  p_day_of_month integer,
  p_hour_utc integer,
  p_after timestamptz
) returns timestamptz
language plpgsql
stable
set search_path to 'pg_catalog', 'public'
as $$
declare
  after_utc timestamp := p_after at time zone 'UTC';
  hr interval := make_interval(hours => coalesce(p_hour_utc, 8));
  dow integer := coalesce(p_day_of_week, 1);
  dom integer := coalesce(p_day_of_month, 1);
  step interval;
  period_start timestamp;
  candidate timestamp;
  i integer;
begin
  if p_frequency in ('daily') then
    candidate := date_trunc('day', after_utc) + hr;
    if candidate <= after_utc then candidate := candidate + interval '1 day'; end if;
    return candidate at time zone 'UTC';
  end if;

  if p_frequency in ('weekly', 'biweekly') then
    -- date_trunc('week') is Monday; step back to Sunday, then add the weekday.
    candidate := date_trunc('week', after_utc) - interval '1 day' + make_interval(days => dow) + hr;
    while candidate <= after_utc loop candidate := candidate + interval '7 days'; end loop;
    return candidate at time zone 'UTC';
  end if;

  step := case p_frequency when 'monthly' then interval '1 month' when 'quarterly' then interval '3 months' else interval '1 year' end;
  period_start := date_trunc(case p_frequency when 'monthly' then 'month' when 'quarterly' then 'quarter' else 'year' end, after_utc);
  for i in 0..1 loop
    candidate := period_start
      + make_interval(days => least(dom, extract(day from (period_start + interval '1 month' - interval '1 day'))::integer) - 1)
      + hr;
    if candidate > after_utc then return candidate at time zone 'UTC'; end if;
    period_start := period_start + step;
  end loop;
  return candidate at time zone 'UTC';
end;
$$;

grant execute on function public.scheduled_report_next_run(public.schedule_frequency, integer, integer, integer, timestamptz) to authenticated, service_role;

create or replace function public.enqueue_scheduled_reports()
 returns integer
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  row record;
  n integer := 0;
begin
  for row in
    select * from public.scheduled_reports
     where active and archived_at is null
       and (next_run_at is null or next_run_at <= now())
  loop
    insert into public.report_runs (
      portfolio_id, definition_id, saved_report_id, scheduled_report_id,
      status, parameters, output_format, triggered_by
    ) values (
      row.portfolio_id, row.definition_id, row.saved_report_id, row.id,
      'queued', row.parameters, row.output_format, row.created_by
    );

    update public.scheduled_reports
       set next_run_at = public.scheduled_report_next_run(
             row.frequency, row.day_of_week, row.day_of_month, row.hour_utc,
             -- A biweekly schedule skips the week right after a run.
             case when row.frequency = 'biweekly' then now() + interval '7 days' else now() end),
           last_run_at = now(),
           updated_at = now()
     where id = row.id;
    n := n + 1;
  end loop;
  return n;
end;
$function$;
