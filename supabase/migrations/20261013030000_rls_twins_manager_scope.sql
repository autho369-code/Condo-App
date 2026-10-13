-- The row-level copies of the association checks respect a manager's
-- association scope too (Codex P1 on #335).
--
-- 20261013010000 scoped can_access_association, but policies use its copy
-- rls_private.my_accessible_association_ids() (and my_accessible_unit_ids()
-- built on it), which still returned every association of the company. All
-- 60 tables using them also carry the restrictive mgr_assoc_scope policy,
-- so nothing was exposed; the copies now match the function anyway so no
-- table depends on that second policy alone. my_budget_readable_association_ids
-- (copy of can_read_association_budget) gets the same narrowing for staff.
-- Both run once per query; the filter applies only to scoped managers.

create or replace function rls_private.my_accessible_association_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_op boolean := coalesce(public.is_platform_operator(), false);
  v_pf uuid := public.my_access_portfolio();
  v_scoped boolean := coalesce(public.manager_is_scoped(), false);
begin
  -- Every association can_access_association() lets the caller see.
  if v_op then
    return query select a.id from public.associations a where a.portfolio_id is not null;
  elsif v_pf is not null then
    return query select a.id from public.associations a
      where a.portfolio_id = v_pf
        and (not v_scoped or a.id in (select public.my_managed_association_ids()));
  end if;
end
$function$;

create or replace function rls_private.my_budget_readable_association_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  -- Every association can_read_association_budget() lets the caller read.
  if auth.uid() is null then
    return;
  end if;
  if coalesce(public.is_platform_operator(), false) then
    return query select a.id from public.associations a;
    return;
  end if;
  if coalesce(public.is_any_staff(), false) or coalesce(public.is_company_admin(), false) then
    -- can_access_portfolio for a non-operator is "the caller's company";
    -- a scoped manager only their associations (can_access_association).
    return query select a.id from public.associations a
      where a.portfolio_id = public.my_access_portfolio()
        and (not coalesce(public.manager_is_scoped(), false)
             or a.id in (select public.my_managed_association_ids()));
  end if;
  if coalesce(public.is_board_user(), false) then
    return query select a.id from public.associations a where a.id in (select public.current_board_association_ids());
  end if;
end
$function$;

comment on function public.can_access_association(uuid) is
  'Company access plus a scoped manager''s associations (can_view_association_row). '
  'Policies use the copy rls_private.my_accessible_association_ids(); change both together '
  '(20261013010000, 20261013030000).';
