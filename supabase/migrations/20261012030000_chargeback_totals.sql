-- Chargeback count and unpaid total in one call.
--
-- The Receivables page (/charges) shows a Chargebacks tile on every tab. It
-- used to load every work-order charge into the server (paged) and then
-- look up each one's balance 200 at a time, on every tab, only to count and
-- sum them. This returns the same two numbers: charges with a work order,
-- in the association / owner's units when given, and the sum of balances
-- still due (balance_due from v_charge_balances, else the charged amount;
-- over half a cent, as the page counted). The full list still loads on the
-- Chargeback Insights tab.
--
-- Runs as the caller (row-level security applies), like
-- receivables_page_totals; plans are reused per connection.

create or replace function public.chargeback_totals(
  p_association_id uuid default null,
  p_unit_ids uuid[] default null
)
returns jsonb
language plpgsql
stable
set search_path to 'public'
set plan_cache_mode = force_generic_plan
as $function$
declare
  v_totals jsonb;
begin
  select jsonb_build_object(
           'count', count(*),
           'unpaid', coalesce(sum(x.balance_due) filter (where x.balance_due > 0.004), 0))
    into v_totals
    from (
      select coalesce(cb.balance_due, c.amount) as balance_due
        from public.charges c
        join public.units u on u.id = c.unit_id
        join public.buildings b on b.id = u.building_id
        left join public.v_charge_balances cb on cb.charge_id = c.id
       where c.work_order_id is not null
         and (p_association_id is null or b.association_id = p_association_id)
         and (p_unit_ids is null or c.unit_id = any (p_unit_ids))
    ) x;
  return v_totals;
end
$function$;

revoke all on function public.chargeback_totals(uuid, uuid[]) from public, anon;
grant execute on function public.chargeback_totals(uuid, uuid[]) to authenticated;
