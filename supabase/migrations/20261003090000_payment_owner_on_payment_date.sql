-- A receipt names the homeowner who owned the unit on the payment date, not
-- whoever owns it today. The ownership lookup used to accept any owner whose
-- ownership had not ended before the payment, so a later buyer (no end date)
-- won over the seller who actually paid. Now the ownership must also have
-- started by the payment date; units without unit_owners history fall back to
-- the owner occupancy covering that date.
create or replace view public.receivable_payments_ledger with (security_invoker = true) as
 select p.id as payment_id,
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
    coalesce(owner_row.owner_id, occ_row.owner_id) as owner_id,
    coalesce(owner_row.owner_name, occ_row.owner_name) as owner_name,
    p.charge_id,
    coalesce(primary_charge.description, applied.first_charge_description, p.notes, 'Receipt'::text) as receipt_description,
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
       select uo.owner_id, o.full_name as owner_name
         from public.unit_owners uo
         join public.owners o on o.id = uo.owner_id
        where uo.unit_id = p.unit_id
          and (uo.start_date is null or uo.start_date <= p.payment_date)
          and (uo.end_date is null or uo.end_date >= p.payment_date)
        order by uo.is_primary desc, uo.start_date desc nulls last, uo.created_at desc
        limit 1) owner_row on true
     left join lateral (
       select occ.owner_id, o.full_name as owner_name
         from public.occupancies occ
         join public.owners o on o.id = occ.owner_id
        where occ.unit_id = p.unit_id
          and occ.occupancy_type = 'owner'
          and (occ.move_in_date is null or occ.move_in_date <= p.payment_date)
          and (occ.move_out_date is null or occ.move_out_date >= p.payment_date)
        order by occ.is_primary desc, occ.move_in_date desc nulls last
        limit 1) occ_row on owner_row.owner_id is null
     left join lateral (
       select sum(pa.amount_applied) as applied_amount,
              count(*)::integer as application_count,
              min(c.description) as first_charge_description
         from public.payment_applications pa
         left join public.charges c on c.id = pa.charge_id
        where pa.payment_id = p.id) applied on true;
