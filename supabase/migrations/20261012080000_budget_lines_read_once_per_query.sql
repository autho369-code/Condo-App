-- Budget lines: the read policy no longer calls a permission function once
-- per row.
--
-- budget_lines_scoped_read called can_read_association_budget(association_id)
-- (a SECURITY DEFINER PL/pgSQL function that itself calls is_platform_operator,
-- is_any_staff, is_company_admin, can_access_portfolio, can_access_association,
-- is_board_user and current_board_association_ids) for every row. Measured on
-- production in a rolled-back transaction with 6,000 lines (600 GL accounts x
-- 10 years): 4.0 s manager, 4.2 s company admin, 5.4 s board, 0.7 s operator,
-- and 3.6-3.8 s for owners and vendors who see none. Budget, budget vs
-- actuals and the board budget pages read this table.
--
-- rls_private.my_budget_readable_association_ids() returns the same set once
-- per query: every association for the platform operator; for staff and
-- company admins the associations of a company they can access
-- (can_access_association is can_access_portfolio of the association's
-- company, so the two old checks are one); for board members their boards'
-- associations. Same rows for manager, company admin, operator, board, owner
-- and vendor (checked old vs new); 107-108 ms for those who see 6,000 lines,
-- 1 ms for owners and vendors. association_budgets_read moves to the same
-- set. The GL scope check stays per row (about
-- 100 ms at 6,000 lines). The write policies are unchanged (they touch one
-- line at a time).

create or replace function rls_private.my_budget_readable_association_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
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
    -- can_access_portfolio for a non-operator is "the caller's company".
    return query select a.id from public.associations a where a.portfolio_id = public.my_access_portfolio();
  end if;
  if coalesce(public.is_board_user(), false) then
    return query select a.id from public.associations a where a.id in (select public.current_board_association_ids());
  end if;
end
$$;

revoke all on function rls_private.my_budget_readable_association_ids() from public, anon;
grant execute on function rls_private.my_budget_readable_association_ids() to authenticated, service_role;

alter policy budget_lines_scoped_read on public.budget_lines
  using (
    (association_id in (select rls_private.my_budget_readable_association_ids()))
    and public.budget_gl_account_scope_valid(association_id, gl_account_id)
  );

-- association_budgets (one row per association and year) reads the same set.
alter policy association_budgets_read on public.association_budgets
  using (association_id in (select rls_private.my_budget_readable_association_ids()));

comment on function public.can_read_association_budget(uuid) is
  'budget_lines_scoped_read and association_budgets_read use the twin: association_id IN (select rls_private.my_budget_readable_association_ids()). Change both together (20261012080000).';
