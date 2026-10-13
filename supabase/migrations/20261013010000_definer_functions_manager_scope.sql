-- Database functions that checked only the company now also respect a
-- manager's association scope (security-reviewer on #333: "sweep definer
-- functions that check only the company").
--
-- A sweep of every security-definer function callable by signed-in users
-- that takes a record id found these staff paths that a manager assigned to
-- some associations could use on another association's records:
--
-- 1. can_access_association(a_id) checked only the company. It is the
--    association check behind can_access_unit, can_access_meeting,
--    can_read_association_budget (budget lines, budget vs actuals, budget
--    worksheet, meeting financial snapshot), can_mutate_association_budget,
--    can_manage_violations and set_owner_late_fee_override. It now also
--    requires can_view_association_row (true for everyone who is not a
--    scoped manager). No policy calls it directly. Its row-level twin
--    rls_private.my_accessible_association_ids (and my_accessible_unit_ids)
--    stays company-wide: all 60 tables whose policies use it carry the
--    restrictive mgr_assoc_scope policy (checked in pg_policies), which
--    narrows them for scoped managers.
-- 2. add_record_note / set_record_tags / update_record_note: the record must
--    be in the caller's scope (new helper app_record_in_manager_scope).
-- 3. calculate_meeting_quorum, rate_work_order, set_board_approval_settings:
--    the staff branch also requires can_view_association_row.
--
-- Functions changed in place: each replacement is checked to have matched
-- exactly once, so a definition that drifted fails the migration instead of
-- silently staying open. Owner, tenant, vendor, board, platform-operator and
-- company-admin-only functions were reviewed and are out of scope (scoped
-- managers cannot pass their checks, or they are company-wide settings).

create or replace function public.can_access_association(a_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$#variable_conflict use_column
begin
  return (select s.x from (

  select a_id is not null
    and exists (
      select 1 from public.associations a
      where a.id = a_id
        and public.can_access_portfolio(a.portfolio_id)
    )
    and public.can_view_association_row(a_id)
  ) s(x) limit 1);
end$function$;

-- Whether a record named by type + id is inside a scoped manager's
-- associations (true for everyone else).
create or replace function public.app_record_in_manager_scope(p_entity_type text, p_entity_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  if (select public.manager_is_scoped()) is not true then
    return true;
  end if;
  return case p_entity_type
    when 'association' then public.can_view_association_row(p_entity_id)
    when 'unit' then exists (
      select 1 from public.units u join public.buildings b on b.id = u.building_id
       where u.id = p_entity_id and public.can_view_association_row(b.association_id))
    when 'owner' then exists (
      select 1 from public.owners o
       where o.id = p_entity_id and public.can_view_association_row(o.association_id))
    when 'vendor' then exists (
      select 1 from public.vendors v
       where v.id = p_entity_id and public.can_view_association_row(v.association_id))
    else false
  end;
end
$function$;

revoke all on function public.app_record_in_manager_scope(text, uuid) from public, anon;
grant execute on function public.app_record_in_manager_scope(text, uuid) to authenticated, service_role;

do $$
declare
  r record;
  def text;
  patched text;
begin
  for r in
    select * from (values
      ('public.add_record_note(text, uuid, text, uuid[], text)',
       'if v_pid is null or not public.can_access_portfolio(v_pid) then',
       'if v_pid is null or not public.can_access_portfolio(v_pid) or not public.app_record_in_manager_scope(p_entity_type, p_entity_id) then'),
      ('public.set_record_tags(text, uuid, text[])',
       'if v_pid is null or not public.can_access_portfolio(v_pid) then',
       'if v_pid is null or not public.can_access_portfolio(v_pid) or not public.app_record_in_manager_scope(p_entity_type, p_entity_id) then'),
      ('public.update_record_note(uuid, boolean, boolean)',
       'if not found or not public.can_access_portfolio(n.portfolio_id) then',
       'if not found or not public.can_access_portfolio(n.portfolio_id) or not public.app_record_in_manager_scope(n.entity_type, n.entity_id) then'),
      ('public.calculate_meeting_quorum(uuid)',
       'and public.can_access_portfolio(v_meeting.portfolio_id)',
       'and public.can_access_portfolio(v_meeting.portfolio_id) and public.can_view_association_row(v_meeting.association_id)'),
      ('public.rate_work_order(uuid, integer, integer, integer, integer, boolean, text)',
       'if public.can_access_portfolio(wo.portfolio_id) then',
       'if public.can_access_portfolio(wo.portfolio_id) and public.can_view_association_row(wo.association_id) then'),
      ('public.set_board_approval_settings(uuid, boolean, voting_scheme, smallint, text, numeric, text, numeric)',
       'v_portfolio = public.current_portfolio_id())',
       'v_portfolio = public.current_portfolio_id() and public.can_view_association_row(p_association_id))')
    ) v(fn, old_text, new_text)
  loop
    def := pg_get_functiondef(r.fn::regprocedure);
    if position(r.new_text in def) > 0 then
      continue; -- already applied
    end if;
    if (length(def) - length(replace(def, r.old_text, ''))) / length(r.old_text) <> 1 then
      raise exception 'Expected exactly one "%" in %', r.old_text, r.fn;
    end if;
    patched := replace(def, r.old_text, r.new_text);
    execute patched;
  end loop;
end
$$;
