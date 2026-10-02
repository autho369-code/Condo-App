-- A schedule runs at a local time in its own time zone ("8:00 AM Central"),
-- so its runs keep that wall-clock time across daylight-saving changes and
-- its day of week / month are local days. Schedules saved before this keep
-- running on hour_utc in UTC.
alter table public.scheduled_reports
  add column if not exists time_zone text,
  add column if not exists local_hour smallint check (local_hour between 0 and 23);

drop function if exists public.scheduled_report_next_run(public.schedule_frequency, integer, integer, integer, timestamptz);

create or replace function public.scheduled_report_next_run(
  p_frequency public.schedule_frequency,
  p_day_of_week integer,
  p_day_of_month integer,
  p_hour integer,
  p_time_zone text,
  p_after timestamptz
) returns timestamptz
language plpgsql
stable
set search_path to 'pg_catalog', 'public'
as $$
declare
  zone text := coalesce(nullif(p_time_zone, ''), 'UTC');
  after_local timestamp;
  hr interval := make_interval(hours => coalesce(p_hour, 8));
  dow integer := coalesce(p_day_of_week, 1);
  dom integer := coalesce(p_day_of_month, 1);
  step interval;
  period_start timestamp;
  candidate timestamp;
  i integer;
begin
  -- An unknown zone name raises here rather than scheduling at a wrong time.
  after_local := p_after at time zone zone;

  if p_frequency = 'daily' then
    candidate := date_trunc('day', after_local) + hr;
    if candidate <= after_local then candidate := candidate + interval '1 day'; end if;
    return candidate at time zone zone;
  end if;

  if p_frequency in ('weekly', 'biweekly') then
    -- date_trunc('week') is Monday; step back to Sunday, then add the weekday (0 = Sunday).
    candidate := date_trunc('week', after_local) - interval '1 day' + make_interval(days => dow) + hr;
    while candidate <= after_local loop candidate := candidate + interval '7 days'; end loop;
    return candidate at time zone zone;
  end if;

  step := case p_frequency when 'monthly' then interval '1 month' when 'quarterly' then interval '3 months' else interval '1 year' end;
  period_start := date_trunc(case p_frequency when 'monthly' then 'month' when 'quarterly' then 'quarter' else 'year' end, after_local);
  for i in 0..1 loop
    -- A day past the month's end runs on its last day.
    candidate := period_start
      + make_interval(days => least(dom, extract(day from (period_start + interval '1 month' - interval '1 day'))::integer) - 1)
      + hr;
    if candidate > after_local then return candidate at time zone zone; end if;
    period_start := period_start + step;
  end loop;
  return candidate at time zone zone;
end;
$$;

grant execute on function public.scheduled_report_next_run(public.schedule_frequency, integer, integer, integer, text, timestamptz) to authenticated, service_role;

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
             row.frequency, row.day_of_week, row.day_of_month,
             coalesce(row.local_hour, row.hour_utc),
             case when row.local_hour is null then 'UTC' else row.time_zone end,
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
