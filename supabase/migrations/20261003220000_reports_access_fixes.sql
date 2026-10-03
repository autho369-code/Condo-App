-- Reports audit fixes.
-- 1. One access rule for report parameters, used both when a run is
--    generated (as the requesting user) and when someone views it (as the
--    viewer): company access, finance-only tax/corporate reports, the
--    association, the unit (must be in a viewable association, and in the
--    chosen one), and company-wide reports (audit log, users, login audit, ...)
--    only for unscoped staff. Viewing a run used to need only company access,
--    so any staffer could download another association's ledger or a 1099
--    file with full TINs.
-- 2. report_runs is written only through RPCs (queue, cancel) and the
--    service-role worker; a client could set status/output_url directly, and
--    the scheduled-report email sends output_url.
-- 3. Reports outputs in storage follow the run's visibility.
-- 4. Homeowner and Unit filters a report does not support are refused instead
--    of silently ignored (the file held every owner).
-- 5. Vendor 1099 uses the year of the chosen period (it always used last year).
-- 6. Homeowner Ledger covers the current ownership of the unit only, so a new
--    owner's ledger doesn't carry the previous owner's history.

create or replace function public.report_params_access_error(p_portfolio_id uuid, p_slug text, p_params jsonb)
returns text language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v_assoc uuid;
  v_unit uuid;
  v_unit_assoc uuid;
  v_slug text := coalesce(p_slug, '');
begin
  begin
    v_assoc := nullif(p_params ->> 'association_id', '')::uuid;
    v_unit := nullif(p_params ->> 'unit_id', '')::uuid;
  exception when invalid_text_representation then
    return 'The selected association or unit is not valid.';
  end;

  if not public.can_access_portfolio(p_portfolio_id) then
    return 'You no longer have access to this company.';
  end if;
  if v_slug ~ '(1099|_tax_|^corporate_|^customer_ledger$)' and not public.can_manage_finance(p_portfolio_id) then
    return 'Tax and corporate accounting reports are limited to finance staff.';
  end if;
  if v_slug in ('association_log', 'email_delivery_errors', 'survey_results', 'users', 'login_audit',
                'user_roles_permissions', 'vendor_directory', 'inventory_status', 'property_group_directory')
     and public.manager_is_scoped() then
    return 'This company-wide report is limited to staff with access to every association.';
  end if;
  if v_assoc is not null and not exists (
       select 1 from public.associations a
        where a.id = v_assoc and a.portfolio_id = p_portfolio_id and public.can_view_association_row(a.id)) then
    return 'You cannot access the selected association.';
  end if;
  if v_assoc is null and public.manager_is_scoped() then
    return 'Choose one of your associations for this report.';
  end if;
  if nullif(p_params ->> 'owner_id', '') is not null then
    return 'This report cannot be filtered by homeowner. Choose an association instead.';
  end if;
  if v_unit is not null then
    if v_slug not in ('owner_ledger', 'homeowner_ledger', 'homeowner_resale') then
      return 'This report cannot be filtered by unit. Choose an association instead.';
    end if;
    select b.association_id into v_unit_assoc
      from public.units u join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id
     where u.id = v_unit and a.portfolio_id = p_portfolio_id;
    if v_unit_assoc is null or not public.can_view_association_row(v_unit_assoc) then
      return 'You cannot access the selected unit.';
    end if;
    if v_assoc is not null and v_unit_assoc <> v_assoc then
      return 'The selected unit is not in the selected association.';
    end if;
  end if;
  return null;
end $$;
revoke all on function public.report_params_access_error(uuid, text, jsonb) from public, anon;
grant execute on function public.report_params_access_error(uuid, text, jsonb) to authenticated;

-- Generation: the same rule, as the user who requested the run.
create or replace function public.report_run_access_error(p_run_id uuid)
returns text language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare
  v_run record;
  v_claims text := current_setting('request.jwt.claims', true);
  v_sub text := current_setting('request.jwt.claim.sub', true);
  v_error text;
begin
  select r.portfolio_id, r.parameters, r.triggered_by, d.slug
    into v_run
    from public.report_runs r
    left join public.report_definitions d on d.id = r.definition_id
   where r.id = p_run_id;
  if not found then return 'Report run not found.'; end if;
  if v_run.triggered_by is null then return 'This report run has no requesting user.'; end if;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_run.triggered_by, 'role', 'authenticated')::text, true);
  v_error := public.report_params_access_error(v_run.portfolio_id, v_run.slug, coalesce(v_run.parameters, '{}'::jsonb));
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  return v_error;
end $$;

-- Viewing: the viewer must pass the same rule for the run's report and filters.
create or replace function public.app_can_view_report_run(p_portfolio_id uuid, p_definition_id uuid, p_params jsonb)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.is_platform_operator()
      or public.report_params_access_error(p_portfolio_id,
           (select d.slug from public.report_definitions d where d.id = p_definition_id),
           coalesce(p_params, '{}'::jsonb)) is null;
$$;
revoke all on function public.app_can_view_report_run(uuid, uuid, jsonb) from public, anon;
grant execute on function public.app_can_view_report_run(uuid, uuid, jsonb) to authenticated;

alter policy report_runs_staff_all on public.report_runs
  using (public.app_can_view_report_run(portfolio_id, definition_id, parameters))
  with check (false);
revoke insert, update, truncate on public.report_runs from authenticated, anon;

-- Queue: checked up front (definer, since clients no longer insert directly).
create or replace function public.queue_report_run(p_definition_id uuid, p_parameters jsonb default '{}'::jsonb,
  p_saved_report_id uuid default null, p_output_format public.report_format default 'csv'::public.report_format)
returns public.report_runs language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare
  def public.report_definitions;
  row public.report_runs;
  target_portfolio uuid;
  v_error text;
begin
  select * into def from public.report_definitions where id = p_definition_id and active;
  if not found then raise exception 'report definition not found'; end if;
  target_portfolio := coalesce(def.portfolio_id, public.current_portfolio_id());
  if target_portfolio is null then raise exception 'cannot determine target portfolio for report run'; end if;
  if not public.can_access_portfolio(target_portfolio) then
    raise exception 'insufficient permissions for portfolio %', target_portfolio using errcode = '42501';
  end if;
  v_error := public.report_params_access_error(target_portfolio, def.slug, coalesce(p_parameters, '{}'::jsonb));
  if v_error is not null then raise exception '%', v_error using errcode = '42501'; end if;
  if p_saved_report_id is not null and not exists (
       select 1 from public.saved_reports s where s.id = p_saved_report_id and s.portfolio_id = target_portfolio) then
    raise exception 'saved report not found' using errcode = 'P0002';
  end if;

  insert into public.report_runs (portfolio_id, definition_id, saved_report_id, status, parameters, output_format, triggered_by)
  values (target_portfolio, p_definition_id, p_saved_report_id, 'queued', coalesce(p_parameters, '{}'::jsonb), p_output_format, auth.uid())
  returning * into row;
  return row;
end $$;
revoke all on function public.queue_report_run(uuid, jsonb, uuid, public.report_format) from public, anon;
grant execute on function public.queue_report_run(uuid, jsonb, uuid, public.report_format) to authenticated;

-- Cancel a queued or running report the caller can see.
create or replace function public.cancel_report_run(p_run_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare r public.report_runs;
begin
  select * into r from public.report_runs where id = p_run_id for update;
  if not found or not public.app_can_view_report_run(r.portfolio_id, r.definition_id, r.parameters) then
    raise exception 'Report run not found' using errcode = 'P0002';
  end if;
  if r.status not in ('queued', 'running') then
    raise exception 'This report has already finished' using errcode = '22023';
  end if;
  update public.report_runs set status = 'cancelled', finished_at = now(), updated_at = now() where id = r.id;
end $$;
revoke all on function public.cancel_report_run(uuid) from public, anon;
grant execute on function public.cancel_report_run(uuid) to authenticated;

-- Storage: a report file is readable by whoever can see its run.
alter policy reports_staff_read on storage.objects
  using (bucket_id = 'reports' and (public.is_platform_operator() or exists (
    select 1 from public.report_runs r
     where r.id::text = split_part(split_part(name, '/', 2), '.', 1)
       and r.portfolio_id::text = split_part(name, '/', 1))));

-- Vendor 1099: the tax year of the chosen period.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.report_data_vendor_1099(uuid, jsonb)'::regprocedure);
  if position('coalesce((p_params->>''tax_year'')::integer,' in def) = 0 then raise exception 'report_data_vendor_1099 drifted'; end if;
  def := replace(def, 'coalesce((p_params->>''tax_year'')::integer,',
    'coalesce((p_params->>''tax_year'')::integer, extract(year from nullif(p_params->>''date_to'', '''')::date)::integer,');
  execute def;
end $$;

-- Homeowner Ledger: the current ownership of the unit (as of the end date).
do $$
declare def text;
begin
  def := pg_get_functiondef('public.report_data_homeowner_ledger(uuid, jsonb)'::regprocedure);
  if position('  if t_from > t_to then' in def) = 0
     or position('where c.unit_id = t_unit and c.due_date < t_from' in def) = 0
     or position('where p.unit_id = t_unit and p.payment_date < t_from' in def) = 0 then
    raise exception 'report_data_homeowner_ledger drifted';
  end if;
  def := replace(def, '  t_opening numeric;', '  t_opening numeric;' || chr(10) || '  t_owner_from date;');
  def := replace(def, '  if t_from > t_to then',
    '  -- Only the ownership that holds the unit on the end date.' || chr(10) ||
    '  select b.period_from into t_owner_from from public.app_ownership_bounds(t_unit, t_to) b;' || chr(10) ||
    '  if t_owner_from > ''-infinity''::date and t_from < t_owner_from then t_from := t_owner_from; end if;' || chr(10) || chr(10) ||
    '  if t_from > t_to then');
  def := replace(def, 'where c.unit_id = t_unit and c.due_date < t_from',
    'where c.unit_id = t_unit and c.due_date < t_from and c.due_date >= t_owner_from');
  def := replace(def, 'where p.unit_id = t_unit and p.payment_date < t_from',
    'where p.unit_id = t_unit and p.payment_date < t_from and p.payment_date >= t_owner_from');
  execute def;
end $$;

-- Bulk runs: the same access rule per association and report, up front.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.bulk_queue_reports(uuid[], text[], text, date, date, text)'::regprocedure);
  if position('      insert into public.report_runs (' in def) = 0 then raise exception 'bulk_queue_reports drifted'; end if;
  def := replace(def, '      insert into public.report_runs (',
    '      if public.report_params_access_error(v_portfolio_id, v_slug, jsonb_build_object(''association_id'', v_assoc_id)) is not null then' || chr(10) ||
    '        raise exception ''%'', public.report_params_access_error(v_portfolio_id, v_slug, jsonb_build_object(''association_id'', v_assoc_id))' || chr(10) ||
    '          using errcode = ''42501'';' || chr(10) ||
    '      end if;' || chr(10) || chr(10) ||
    '      insert into public.report_runs (');
  execute def;
end $$;
