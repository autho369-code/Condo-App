-- The manager Units page orders and labels rows by association_name. The
-- baseline view omitted that column, causing PostgREST to reject the query and
-- the page to silently display zero units. Append the label without changing
-- the existing column order or the security-invoker tenant boundary.
create or replace view public.v_unit_account_summary
with (security_invoker = true)
as
select
  u.id as unit_id,
  u.unit_number,
  b.association_id,
  a.portfolio_id,
  coalesce((
    select sum(c.amount)
    from public.charges c
    where c.unit_id = u.id
  ), 0::numeric) as total_charged,
  coalesce((
    select sum(p.amount)
    from public.payments p
    where p.unit_id = u.id
  ), 0::numeric) as total_paid,
  coalesce((
    select sum(pa.amount_applied)
    from public.payment_applications pa
    join public.charges c on c.id = pa.charge_id
    where c.unit_id = u.id
  ), 0::numeric) as total_applied,
  coalesce((
    select sum(vcb.balance_due)
    from public.v_charge_balances vcb
    where vcb.unit_id = u.id
      and vcb.balance_due > 0::numeric
  ), 0::numeric) as outstanding_balance,
  coalesce((
    select sum(vuc.unapplied_amount)
    from public.v_unapplied_credits vuc
    where vuc.unit_id = u.id
  ), 0::numeric) as unapplied_credit,
  a.name as association_name
from public.units u
join public.buildings b on b.id = u.building_id
join public.associations a on a.id = b.association_id
where u.archived_at is null;

grant select on public.v_unit_account_summary to authenticated;
grant all on public.v_unit_account_summary to service_role;
