-- Import Variances: compare per unit and as-of date, not per imported row.
--
-- The AppFolio Aged Receivable import records one imported_balances row per
-- open charge, so a unit with three open items has three rows. Each row was
-- compared against the unit's whole system balance, which showed false
-- variances. Rows for the same unit and as-of date are now summed first, and
-- each date is compared as a running total of everything imported for the
-- unit up to that date (the system balance on a later date already includes
-- earlier imports). The period filter applies after the running total. A
-- single-row import (the CSV opening-balance import) reads exactly as before.
-- Same signature, so existing grants and the report dispatcher are unchanged.

create or replace function public.report_data_import_variances(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.association, r.unit, r.as_of_date), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params)),
         grouped as (
           select ib.association_id, ib.unit_id, ib.as_of_date,
                  sum(ib.imported_balance) as imported_balance,
                  case when count(*) = 1 then max(ib.memo)
                       else count(*)::text || ' imported items' end as memo,
                  max(ib.created_at) as created_at
             from public.imported_balances ib
             cross join prm
            where ib.portfolio_id = p_portfolio_id and (prm.aid is null or ib.association_id = prm.aid)
            group by ib.association_id, ib.unit_id, ib.as_of_date
         ),
         running as (
           select g.association_id, g.unit_id, g.as_of_date, g.memo, g.created_at,
                  sum(g.imported_balance) over (partition by g.association_id, g.unit_id order by g.as_of_date) as imported_balance
             from grouped g
         ),
         rows as (
           select g.*, a.name as association, u.unit_number as unit,
                  (select coalesce(sum(c.amount), 0) from public.charges c where c.unit_id = g.unit_id and c.due_date <= g.as_of_date)
                - (select coalesce(sum(p.amount), 0) from public.payments p where p.unit_id = g.unit_id and p.payment_date <= g.as_of_date) as system_balance,
                  (select ub.balance from public.unit_balances ub where ub.unit_id = g.unit_id) as current_balance
             from running g
             cross join prm
             join public.associations a on a.id = g.association_id
             join public.units u on u.id = g.unit_id
            where g.as_of_date between prm.df and prm.dt
         )
    select association, unit, as_of_date, round(imported_balance, 2) as imported_balance, round(system_balance, 2) as system_balance,
           round(system_balance - imported_balance, 2) as variance, round(current_balance, 2) as current_balance,
           memo, created_at::date as imported_on
      from rows
     where (coalesce(p_params->>'only_variances', '') <> 'true' or round(system_balance - imported_balance, 2) <> 0)
  ) r;
$$;
