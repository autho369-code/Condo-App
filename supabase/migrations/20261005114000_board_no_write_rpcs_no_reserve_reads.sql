-- Read-only board, continued.
--
-- 1. Board branches removed from the remaining write RPCs:
--    rate_work_order (board could rate a vendor), calculate_meeting_quorum
--    (+ impl) and record_meeting_attendance_tenant_checked_impl (board could
--    write meeting rows). Staff and owner paths are unchanged; a board member
--    who is also an owner still signs in as an owner.
do $$
declare
  r record;
  v_def text;
  v_new text;
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('rate_work_order', 'calculate_meeting_quorum',
                                'calculate_meeting_quorum_tenant_checked_impl',
                                'record_meeting_attendance_tenant_checked_impl')
  loop
    v_def := pg_get_functiondef(r.oid);
    v_new := v_def;
    if r.proname = 'rate_work_order' then
      v_new := replace(v_new,
        'elsif wo.association_id is not null and wo.association_id in (select public.current_board_association_ids()) then',
        'elsif false then');
    elsif r.proname = 'record_meeting_attendance_tenant_checked_impl' then
      v_new := replace(v_new,
        'if not (v_is_staff or v_is_board or v_is_resident) then',
        'if not (v_is_staff or v_is_resident) then');
    else
      v_new := regexp_replace(v_new,
        'or \(\s*public\.is_board_user\(\)\s*and v_meeting\.association_id in \(select public\.current_board_association_ids\(\)\)\s*\)',
        '');
    end if;
    if v_new = v_def then
      raise exception 'board branch not found in %', r.proname;
    end if;
    execute v_new;
  end loop;
end $$;

-- 2. Reserve studies are planning records, not board financials.
alter policy reserve_studies_read on public.reserve_studies
  using (is_platform_operator() or can_access_portfolio(portfolio_id));
alter policy reserve_components_read on public.reserve_components
  using (is_platform_operator() or can_access_portfolio(portfolio_id));
alter policy reserve_scenarios_read on public.reserve_funding_scenarios
  using (is_platform_operator() or can_access_portfolio(portfolio_id));

-- 3. Approval votes went with approval requests.
alter policy approval_decisions_select on public.approval_decisions
  using (is_platform_operator() or exists (
    select 1 from public.approval_requests r
     where r.id = approval_decisions.approval_request_id
       and can_access_portfolio(r.portfolio_id)));
