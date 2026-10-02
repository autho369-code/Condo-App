-- Receivables as they stood at a past moment, for month-by-month metrics.
-- receivable_summary reads today's balances (later payments and charges
-- change earlier months); this rebuilds each charge's balance from charges
-- posted and payments applied before p_cutoff. A unit is delinquent only
-- when it has an overdue balance (due before p_as_of).
create or replace function public.receivable_summary_as_of(
  p_association_ids uuid[],
  p_as_of date,
  p_cutoff timestamptz
) returns table(ar_total numeric, overdue_total numeric, delinquent_units integer)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  with bal as (
    select c.unit_id,
           c.due_date,
           c.amount - coalesce((
             select sum(pa.amount_applied)
               from public.payment_applications pa
              where pa.charge_id = c.id
                and coalesce(pa.applied_at, pa.created_at) < p_cutoff
           ), 0) as due
      from public.charges c
      join public.units u on u.id = c.unit_id
      join public.buildings b on b.id = u.building_id
     where c.created_at < p_cutoff
       and (p_association_ids is null or b.association_id = any (p_association_ids))
  )
  select coalesce(sum(due) filter (where due > 0), 0)::numeric,
         coalesce(sum(due) filter (where due > 0 and due_date < p_as_of), 0)::numeric,
         (count(distinct unit_id) filter (where due > 0 and due_date < p_as_of))::integer
    from bal;
$$;

revoke all on function public.receivable_summary_as_of(uuid[], date, timestamptz) from public, anon;
grant execute on function public.receivable_summary_as_of(uuid[], date, timestamptz) to authenticated, service_role;
