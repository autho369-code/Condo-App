-- Scheduled reports run as a person who may run them.
-- A schedule's runs were generated as created_by, but any staffer in the
-- company could update any schedule (or insert one naming someone else as
-- created_by) through the API: point a finance user's 1099 schedule at their
-- own email, or another association's ledger, and receive it.
-- 1. run_as: the person who last set what the schedule sends or to whom
--    (report, filters, format, delivery). Runs are generated as run_as, and
--    that person must pass the report access rule when they make the change.
-- 2. created_by and portfolio_id are set by the database, not the client.
-- 3. Staff see and change only schedules for reports they could run.

alter table public.scheduled_reports add column if not exists run_as uuid references auth.users(id);
update public.scheduled_reports set run_as = created_by where run_as is null;

-- Runs as the caller (not definer) so current_user tells API writes apart.
create or replace function public.guard_scheduled_report_change()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare
  v_slug text;
  v_error text;
begin
  -- Only API callers are constrained; the scheduler (definer functions,
  -- service role) moves next_run_at / last_run_at freely.
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if auth.uid() is null then raise exception 'Sign in to change scheduled reports' using errcode = '42501'; end if;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.run_as := auth.uid();
  else
    new.created_by := old.created_by;
    new.portfolio_id := old.portfolio_id;
    if (new.definition_id, new.saved_report_id, new.parameters, new.delivery_targets, new.delivery_channel, new.output_format)
       is distinct from (old.definition_id, old.saved_report_id, old.parameters, old.delivery_targets, old.delivery_channel, old.output_format) then
      new.run_as := auth.uid();
    else
      new.run_as := old.run_as;
    end if;
  end if;

  if tg_op = 'INSERT' or new.run_as is distinct from old.run_as or new.parameters is distinct from old.parameters
     or new.definition_id is distinct from old.definition_id or new.saved_report_id is distinct from old.saved_report_id then
    if new.saved_report_id is not null and not exists (
         select 1 from public.saved_reports s where s.id = new.saved_report_id and s.portfolio_id = new.portfolio_id) then
      raise exception 'That custom report was not found' using errcode = 'P0002';
    end if;
    select d.slug into v_slug from public.report_definitions d where d.id = new.definition_id and d.active;
    if v_slug is null then raise exception 'That report is not available' using errcode = 'P0002'; end if;
    v_error := public.report_params_access_error(new.portfolio_id, v_slug, coalesce(new.parameters, '{}'::jsonb));
    if v_error is not null then raise exception '%', v_error using errcode = '42501'; end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_scheduled_report_change() from public, anon, authenticated;

create or replace trigger trg_guard_scheduled_report_change before insert or update on public.scheduled_reports
  for each row execute function public.guard_scheduled_report_change();

-- Visible and changeable only for a report the caller could run.
create or replace function public.app_can_use_scheduled_report(p_portfolio_id uuid, p_definition_id uuid, p_params jsonb)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.is_platform_operator()
      or public.report_params_access_error(p_portfolio_id,
           (select d.slug from public.report_definitions d where d.id = p_definition_id),
           coalesce(p_params, '{}'::jsonb)) is null;
$$;
revoke all on function public.app_can_use_scheduled_report(uuid, uuid, jsonb) from public, anon;
grant execute on function public.app_can_use_scheduled_report(uuid, uuid, jsonb) to authenticated;

alter policy scheduled_reports_staff_all on public.scheduled_reports
  using (public.can_access_portfolio(portfolio_id) and (public.is_any_staff() or public.is_platform_operator())
         and public.app_can_use_scheduled_report(portfolio_id, definition_id, parameters))
  with check (public.can_access_portfolio(portfolio_id) and (public.is_any_staff() or public.is_platform_operator()));
revoke truncate on public.scheduled_reports from authenticated, anon;

-- The scheduler generates each run as run_as.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.enqueue_scheduled_reports()'::regprocedure);
  if position('''queued'', row.parameters, row.output_format, row.created_by' in def) = 0 then
    raise exception 'enqueue_scheduled_reports drifted';
  end if;
  def := replace(def, '''queued'', row.parameters, row.output_format, row.created_by',
    '''queued'', row.parameters, row.output_format, coalesce(row.run_as, row.created_by)');
  execute def;
end $$;
