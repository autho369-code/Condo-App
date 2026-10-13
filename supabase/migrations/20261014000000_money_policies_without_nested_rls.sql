-- Speed: the access rules on charges, payments and payment_applications no
-- longer expand other tables' access rules inside the query plan.
--
-- Several policies looked up units, buildings, payments or charges with an
-- inline subquery. Each of those tables has its own policies, so Postgres
-- expanded them inside the outer plan, recursively: a one-unit owner query
-- on v_charge_balances planned for ~190 ms and initialised thousands of
-- plan nodes (measured at 2,000 units, rolled back). Every role paid it:
-- owner 315 ms for v_unit_account_summary of one unit, board 222, manager
-- 216.
--
-- The same lookups now sit in small rls_private functions that run as the
-- caller (SECURITY INVOKER), so the caller's own policies still decide what
-- they return, exactly as the inline subqueries did; the outer plan holds
-- one opaque call instead of the expansion. Who sees what is unchanged
-- (verified per role: the same visible ids before and after). Policies are
-- altered in place (no DROP); USING and WITH CHECK are set together where a
-- policy has both.

create or replace function rls_private.visible_unit_ids()
returns setof uuid language plpgsql stable security invoker
set search_path = pg_catalog, public
as $$ begin return query select u.id from public.units u; end $$;

create or replace function rls_private.visible_charge_ids()
returns setof uuid language plpgsql stable security invoker
set search_path = pg_catalog, public
as $$ begin return query select c.id from public.charges c; end $$;

create or replace function rls_private.board_unit_ids()
returns setof uuid language plpgsql stable security invoker
set search_path = pg_catalog, public
as $$
begin
  return query
  select u.id
    from public.units u
    join public.buildings b on b.id = u.building_id
   where b.association_id in (select public.current_board_association_ids());
end $$;

create or replace function rls_private.board_payment_ids()
returns setof uuid language plpgsql stable security invoker
set search_path = pg_catalog, public
as $$
begin
  return query
  select p.id
    from public.payments p
    join public.units u on u.id = p.unit_id
    join public.buildings b on b.id = u.building_id
   where b.association_id in (select public.current_board_association_ids());
end $$;

create or replace function rls_private.finance_payment_ids()
returns setof uuid language plpgsql stable security invoker
set search_path = pg_catalog, public
as $$
begin
  return query
  select p.id
    from public.payments p
   where exists (select 1
                   from public.units u
                   join public.buildings b on b.id = u.building_id
                   join public.associations a on a.id = b.association_id
                  where u.id = p.unit_id
                    and (coalesce(a.portfolio_id = (select public.my_finance_portfolio()), false)
                         or ((select public.is_platform_operator()) and a.portfolio_id is not null)));
end $$;

create or replace function rls_private.resident_payment_ids()
returns setof uuid language plpgsql stable security invoker
set search_path = pg_catalog, public
as $$
begin
  return query
  select p.id
    from public.payments p
   where p.unit_id in (select public.current_resident_unit_ids());
end $$;

revoke all on function rls_private.visible_unit_ids(), rls_private.visible_charge_ids(),
  rls_private.board_unit_ids(), rls_private.board_payment_ids(),
  rls_private.finance_payment_ids(), rls_private.resident_payment_ids() from public, anon;
grant execute on function rls_private.visible_unit_ids(), rls_private.visible_charge_ids(),
  rls_private.board_unit_ids(), rls_private.board_payment_ids(),
  rls_private.finance_payment_ids(), rls_private.resident_payment_ids() to authenticated;

-- Restrictive manager scope (WITH CHECK is null: USING applies to writes).
alter policy mgr_assoc_scope on public.charges
  using (((select public.manager_is_scoped()) is not true) or (unit_id is null)
         or (unit_id in (select rls_private.visible_unit_ids())));
alter policy mgr_assoc_scope on public.payments
  using (((select public.manager_is_scoped()) is not true) or (unit_id is null)
         or (unit_id in (select rls_private.visible_unit_ids())));
alter policy mgr_assoc_scope on public.payment_applications
  using (((select public.manager_is_scoped()) is not true)
         or (charge_id in (select rls_private.visible_charge_ids())));

-- Board reads.
alter policy charges_board_read on public.charges
  using ((select public.is_board_user()) and (unit_id in (select rls_private.board_unit_ids())));
alter policy payments_board_read on public.payments
  using ((select public.is_board_user()) and (unit_id in (select rls_private.board_unit_ids())));
alter policy payment_apps_board_read on public.payment_applications
  using ((select public.is_board_user()) and (payment_id in (select rls_private.board_payment_ids())));

-- Finance staff and residents on payment applications.
alter policy payment_apps_finance on public.payment_applications
  using (payment_id in (select rls_private.finance_payment_ids()))
  with check (payment_id in (select rls_private.finance_payment_ids()));
alter policy payment_apps_resident_read on public.payment_applications
  using (payment_id in (select rls_private.resident_payment_ids()));
