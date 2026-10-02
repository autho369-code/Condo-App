-- Report runs are generated with the service role (report_data_* functions and
-- live exports), so RLS never applied to them: an association-scoped manager
-- could export every association in the portfolio, and any staff user could
-- download vendor taxpayer ids through the 1099 reports. report_run_access_error
-- re-evaluates the run against the user who requested it (triggered_by; the
-- schedule's creator for scheduled runs) using the same helpers RLS uses, and
-- returns why it is not allowed (null when it is). processReportRun calls it
-- before producing any output.
create or replace function public.report_run_access_error(p_run_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_run record;
  v_claims text := current_setting('request.jwt.claims', true);
  v_sub text := current_setting('request.jwt.claim.sub', true);
  v_assoc uuid;
  v_error text;
begin
  select r.portfolio_id, r.parameters, r.triggered_by, d.slug
    into v_run
    from public.report_runs r
    left join public.report_definitions d on d.id = r.definition_id
   where r.id = p_run_id;
  if not found then return 'Report run not found.'; end if;
  if v_run.triggered_by is null then return 'This report run has no requesting user.'; end if;

  begin
    v_assoc := nullif(v_run.parameters ->> 'association_id', '')::uuid;
  exception when invalid_text_representation then
    return 'The selected association is not valid.';
  end;

  -- Evaluate the helpers as the requesting user, then restore the caller.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_run.triggered_by, 'role', 'authenticated')::text, true);

  if not public.can_access_portfolio(v_run.portfolio_id) then
    v_error := 'The person who requested this report no longer has access to this company.';
  elsif coalesce(v_run.slug, '') ~ '(1099|_tax_)' and not public.can_manage_finance(v_run.portfolio_id) then
    v_error := 'Tax reports are limited to finance staff.';
  elsif v_assoc is not null and not exists (
    select 1 from public.associations a
     where a.id = v_assoc and a.portfolio_id = v_run.portfolio_id
       and public.can_view_association_row(a.id)
  ) then
    v_error := 'The requesting user cannot access the selected association.';
  elsif v_assoc is null and public.manager_is_scoped() then
    v_error := 'Choose one of your associations for this report.';
  end if;

  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  return v_error;
end $$;

revoke all on function public.report_run_access_error(uuid) from public, anon, authenticated;
grant execute on function public.report_run_access_error(uuid) to service_role;
