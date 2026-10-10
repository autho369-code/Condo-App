-- Speed, part 3: the association/unit set helpers from parts 1 and 2 only
-- look at the caller's own company's associations.
--
-- my_accessible_association_ids(), my_manageable_association_ids() and
-- my_editable_association_ids() called a per-association helper for EVERY
-- association on the platform (once per statement). With many companies
-- that grows with the platform, not with the caller. Each helper's
-- original can only be true for an association in the caller's company
-- (or for a platform operator), so filtering on that first gives the same
-- set:
--   can_access_portfolio / can_manage_association: portfolio_id =
--     my_access_portfolio(), or the caller is a platform operator;
--   can_edit_association_mvp: every non-operator branch joins the caller's
--     profiles.portfolio_id (without the disabled/suspended checks of
--     current_portfolio_id), so filter on that.
-- my_accessible_unit_ids() builds on my_accessible_association_ids().
-- No policy changes. Checked with the same rolled-back comparison as
-- parts 1-2 (each helper's set before vs after, every caller).

create or replace function public.my_accessible_association_ids()
returns setof uuid
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
  v_op boolean := coalesce(public.is_platform_operator(), false);
  v_pf uuid := public.my_access_portfolio();
begin
  -- Every association can_access_association() lets the caller see.
  if v_op then
    return query select a.id from public.associations a where a.portfolio_id is not null;
  elsif v_pf is not null then
    return query select a.id from public.associations a where a.portfolio_id = v_pf;
  end if;
end
$$;

create or replace function public.my_manageable_association_ids()
returns setof uuid
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
  v_op boolean := coalesce(public.is_platform_operator(), false);
  v_pf uuid := public.my_access_portfolio();
begin
  return query
  select a.id from public.associations a
   where (v_op or (v_pf is not null and a.portfolio_id = v_pf))
     and public.can_manage_association(a.id);
end
$$;

create or replace function public.my_editable_association_ids()
returns setof uuid
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
  v_op boolean := coalesce(public.is_platform_operator(), false);
  v_pf uuid := (select p.portfolio_id from public.profiles p where p.id = auth.uid());
begin
  return query
  select a.id from public.associations a
   where (v_op or (v_pf is not null and a.portfolio_id = v_pf))
     and public.can_edit_association_mvp(a.id);
end
$$;
