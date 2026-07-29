-- =============================================================================
-- Phase 13b — Report generator cron + queue-report RPC
-- =============================================================================

-- RPC: any staff can queue a report run (respects portfolio scope)
create or replace function public.queue_report_run(
  p_definition_id uuid,
  p_parameters jsonb default '{}',
  p_saved_report_id uuid default null,
  p_output_format public.report_format default 'csv'
)
returns public.report_runs
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  def public.report_definitions;
  row public.report_runs;
  target_portfolio uuid;
begin
  select * into def from public.report_definitions where id = p_definition_id;
  if not found then
    raise exception 'report definition not found';
  end if;

  target_portfolio := coalesce(def.portfolio_id, public.current_portfolio_id());
  if target_portfolio is null then
    raise exception 'cannot determine target portfolio for report run';
  end if;

  if not public.can_access_portfolio(target_portfolio) then
    raise exception 'insufficient permissions for portfolio %', target_portfolio;
  end if;

  insert into public.report_runs (
    portfolio_id, definition_id, saved_report_id, status,
    parameters, output_format, triggered_by
  ) values (
    target_portfolio, p_definition_id, p_saved_report_id, 'queued',
    p_parameters, p_output_format, auth.uid()
  ) returning * into row;

  return row;
end;
$$;

grant execute on function public.queue_report_run(uuid, jsonb, uuid, public.report_format) to authenticated;

-- Schedule the generator every 2 minutes
select cron.schedule(
  'invoke-generate-report',
  '*/2 * * * *',
  $$ select public.invoke_edge_function('generate-report'); $$
);

-- Also fire the scheduled_reports cron: find due ones and queue a run
create or replace function public.enqueue_scheduled_reports()
returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  row record;
  n integer := 0;
  next_at timestamptz;
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

    -- Compute next_run_at based on frequency
    next_at := case row.frequency
      when 'daily'     then date_trunc('day', now()) + interval '1 day' + make_interval(hours => row.hour_utc)
      when 'weekly'    then date_trunc('week', now()) + interval '1 week' + make_interval(days => coalesce(row.day_of_week, 1), hours => row.hour_utc)
      when 'biweekly'  then now() + interval '2 weeks'
      when 'monthly'   then date_trunc('month', now()) + interval '1 month' + make_interval(days => coalesce(row.day_of_month, 1) - 1, hours => row.hour_utc)
      when 'quarterly' then date_trunc('quarter', now()) + interval '3 months'
      when 'annually'  then date_trunc('year', now()) + interval '1 year'
    end;

    update public.scheduled_reports
       set next_run_at = next_at, last_run_at = now(), updated_at = now()
     where id = row.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

select cron.schedule(
  'enqueue-scheduled-reports',
  '0 * * * *',  -- hourly
  $$ select public.enqueue_scheduled_reports(); $$
);
;
