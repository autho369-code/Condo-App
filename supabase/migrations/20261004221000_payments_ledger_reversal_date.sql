-- Adds reversal_date to receivable_payments_ledger: the effective return date
-- staff chose, stored as the reversal charge's due_date (payments.reversed_at
-- is only when the return was entered). A separate migration so environments
-- that already ran 20261004220000 get the column. The rest of the view is
-- unchanged; security_invoker stays on.
create or replace view public.receivable_payments_ledger with (security_invoker = true) as
 SELECT p.id AS payment_id,
    p.payment_date,
    p.created_at,
    p.amount,
    p.method,
    p.reference,
    p.notes,
    p.unit_id,
    u.unit_number,
    assoc.id AS association_id,
    assoc.name AS association_name,
    COALESCE(owner_row.owner_id, occ_row.owner_id) AS owner_id,
    COALESCE(owner_row.owner_name, occ_row.owner_name) AS owner_name,
    p.charge_id,
    COALESCE(primary_charge.description, applied.first_charge_description, p.notes, 'Receipt'::text) AS receipt_description,
    p.bank_account_id,
    ba.name AS bank_account_name,
    ba.bank_name,
    COALESCE(applied.applied_amount, 0::numeric) AS applied_amount,
    GREATEST(COALESCE(p.amount, 0::numeric) - COALESCE(applied.applied_amount, 0::numeric), 0::numeric) AS unapplied_amount,
    COALESCE(applied.application_count, 0) AS application_count,
    p.reversed_at,
    p.reversal_reason,
    rev_charge.due_date AS reversal_date
   FROM payments p
     LEFT JOIN units u ON u.id = p.unit_id
     LEFT JOIN buildings b ON b.id = u.building_id
     LEFT JOIN associations assoc ON assoc.id = b.association_id
     LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
     LEFT JOIN charges primary_charge ON primary_charge.id = p.charge_id
     LEFT JOIN charges rev_charge ON rev_charge.id = p.reversal_charge_id
     LEFT JOIN LATERAL ( SELECT uo.owner_id,
            o.full_name AS owner_name
           FROM unit_owners uo
             JOIN owners o ON o.id = uo.owner_id
          WHERE uo.unit_id = p.unit_id AND (uo.start_date IS NULL OR uo.start_date <= p.payment_date) AND (uo.end_date IS NULL OR uo.end_date >= p.payment_date)
          ORDER BY uo.is_primary DESC, uo.start_date DESC NULLS LAST, uo.created_at DESC
         LIMIT 1) owner_row ON true
     LEFT JOIN LATERAL ( SELECT occ.owner_id,
            o.full_name AS owner_name
           FROM occupancies occ
             JOIN owners o ON o.id = occ.owner_id
          WHERE occ.unit_id = p.unit_id AND occ.occupancy_type = 'owner'::occupancy_type AND (occ.move_in_date IS NULL OR occ.move_in_date <= p.payment_date) AND (occ.move_out_date IS NULL OR occ.move_out_date >= p.payment_date)
          ORDER BY occ.is_primary DESC, occ.move_in_date DESC NULLS LAST
         LIMIT 1) occ_row ON owner_row.owner_id IS NULL
     LEFT JOIN LATERAL ( SELECT sum(pa.amount_applied) AS applied_amount,
            count(*)::integer AS application_count,
            min(c.description) AS first_charge_description
           FROM payment_applications pa
             LEFT JOIN charges c ON c.id = pa.charge_id
          WHERE pa.payment_id = p.id) applied ON true;
