-- Receivables page totals (Outstanding, Owners delinquent, Overdue balance)
-- were summed from 500-row lists. Sum them in the database, optionally for a
-- set of units (the owner filter). SECURITY INVOKER: RLS applies.
create or replace function public.receivable_unit_totals(p_unit_ids uuid[] default null)
returns table (outstanding_total numeric, delinquent_count integer, delinquent_balance numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select coalesce(sum(ar.balance_due), 0)
       from public.aged_receivables ar
      where p_unit_ids is null or ar.unit_id = any (p_unit_ids))::numeric,
    (select count(*)
       from public.delinquent_units du
      where p_unit_ids is null or du.unit_id = any (p_unit_ids))::integer,
    (select coalesce(sum(du.balance), 0)
       from public.delinquent_units du
      where p_unit_ids is null or du.unit_id = any (p_unit_ids))::numeric;
$$;
revoke all on function public.receivable_unit_totals(uuid[]) from public, anon;
grant execute on function public.receivable_unit_totals(uuid[]) to authenticated, service_role;
