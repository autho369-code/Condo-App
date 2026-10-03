-- Review fixes for 20261003110000 (Import Variances):
-- 1. Posting an opening balance and recording it are one transaction
--    (import_opening_balance), so a failed record never leaves a posted
--    charge behind that a retry would duplicate.
-- 2. imported_balances gets the same restrictive association scope as other
--    association-owned financial tables (mgr_assoc_scope).
-- 3. Import Variances honours the selected period (as-of date).

create or replace function public.import_opening_balance(
  p_unit_id uuid, p_charge_category_id uuid, p_amount numeric, p_description text, p_as_of date
)
returns uuid
language plpgsql
-- Invoker: post_ad_hoc_charge and the imported_balances policies apply as the caller.
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_charge public.charges;
  v_assoc uuid;
  v_pid uuid;
begin
  -- unit_association_id() is not executable by signed-in users; look it up directly.
  select b.association_id, a.portfolio_id into v_assoc, v_pid
    from public.units u join public.buildings b on b.id = u.building_id join public.associations a on a.id = b.association_id
   where u.id = p_unit_id;
  if v_pid is null then raise exception 'Unit not found' using errcode = 'P0002'; end if;
  v_charge := public.post_ad_hoc_charge(p_unit_id, p_charge_category_id, p_amount, p_description, p_as_of);
  insert into public.imported_balances (portfolio_id, association_id, unit_id, as_of_date, imported_balance, memo, charge_id, created_by)
  values (v_pid, v_assoc, p_unit_id, p_as_of, round(p_amount, 2), p_description, v_charge.id, auth.uid());
  return v_charge.id;
end
$function$;
revoke all on function public.import_opening_balance(uuid, uuid, numeric, text, date) from public, anon;
grant execute on function public.import_opening_balance(uuid, uuid, numeric, text, date) to authenticated;

-- The insert check must not call unit_association_id() either (it runs as the
-- signed-in user, who cannot execute it).
alter policy imported_balances_staff_insert on public.imported_balances
  with check (public.is_any_staff() and public.can_access_portfolio(portfolio_id)
              and exists (select 1 from public.units u join public.buildings b on b.id = u.building_id join public.associations a on a.id = b.association_id
                           where u.id = unit_id and b.association_id = imported_balances.association_id and a.portfolio_id = imported_balances.portfolio_id));

create policy mgr_assoc_scope on public.imported_balances
  as restrictive for all to authenticated
  using (public.can_view_association_row(association_id))
  with check (public.can_view_association_row(association_id));

create or replace function public.report_data_import_variances(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.association, r.unit, r.as_of_date), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params)),
         rows as (
           select ib.*, a.name as association, u.unit_number as unit,
                  (select coalesce(sum(c.amount), 0) from public.charges c where c.unit_id = ib.unit_id and c.due_date <= ib.as_of_date)
                - (select coalesce(sum(p.amount), 0) from public.payments p where p.unit_id = ib.unit_id and p.payment_date <= ib.as_of_date) as system_balance,
                  (select ub.balance from public.unit_balances ub where ub.unit_id = ib.unit_id) as current_balance
             from public.imported_balances ib
             cross join prm
             join public.associations a on a.id = ib.association_id
             join public.units u on u.id = ib.unit_id
            where ib.portfolio_id = p_portfolio_id and (prm.aid is null or ib.association_id = prm.aid)
              and ib.as_of_date between prm.df and prm.dt
         )
    select association, unit, as_of_date, imported_balance, round(system_balance, 2) as system_balance,
           round(system_balance - imported_balance, 2) as variance, round(current_balance, 2) as current_balance,
           memo, created_at::date as imported_on
      from rows
     where (coalesce(p_params->>'only_variances', '') <> 'true' or round(system_balance - imported_balance, 2) <> 0)
  ) r;
$$;
