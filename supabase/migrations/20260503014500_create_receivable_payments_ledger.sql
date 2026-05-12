create or replace view public.receivable_payments_ledger
with (security_invoker = true) as
select
  p.id as payment_id,
  p.payment_date,
  p.created_at,
  p.amount,
  p.method,
  p.reference,
  p.notes,
  p.unit_id,
  u.unit_number,
  assoc.id as association_id,
  assoc.name as association_name,
  owner_row.owner_id,
  owner_row.owner_name,
  p.charge_id,
  coalesce(primary_charge.description, applied.first_charge_description, p.notes, 'Receipt') as receipt_description,
  p.bank_account_id,
  ba.name as bank_account_name,
  ba.bank_name,
  coalesce(applied.applied_amount, 0::numeric) as applied_amount,
  greatest(coalesce(p.amount, 0::numeric) - coalesce(applied.applied_amount, 0::numeric), 0::numeric) as unapplied_amount,
  coalesce(applied.application_count, 0) as application_count
from public.payments p
left join public.units u on u.id = p.unit_id
left join public.buildings b on b.id = u.building_id
left join public.associations assoc on assoc.id = b.association_id
left join public.bank_accounts ba on ba.id = p.bank_account_id
left join public.charges primary_charge on primary_charge.id = p.charge_id
left join lateral (
  select
    uo.owner_id,
    o.full_name as owner_name
  from public.unit_owners uo
  join public.owners o on o.id = uo.owner_id
  where uo.unit_id = p.unit_id
    and (uo.end_date is null or uo.end_date >= p.payment_date)
  order by uo.is_primary desc, uo.start_date desc nulls last, uo.created_at desc
  limit 1
) owner_row on true
left join lateral (
  select
    sum(pa.amount_applied) as applied_amount,
    count(*)::integer as application_count,
    min(c.description) as first_charge_description
  from public.payment_applications pa
  left join public.charges c on c.id = pa.charge_id
  where pa.payment_id = p.id
) applied on true;
