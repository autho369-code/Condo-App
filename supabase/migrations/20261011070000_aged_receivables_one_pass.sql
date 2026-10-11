-- Speed: aged_receivables adds up payment applications once, not three
-- times per charge.
--
-- The view summed payment_applications in a correlated subquery written
-- three times (total_paid, balance_due and the WHERE filter), so every
-- charge ran three payment_applications scans, each through that table's
-- row-level security (for a board member: payments -> units -> buildings,
-- each with its own policies). The board dashboard's receivables card
-- timed out ("canceling statement due to statement timeout") with only 15
-- charges, and managers waited ~1 s.
--
-- Now one grouped pass over payment_applications is joined in. Same
-- columns in the same order, same security_invoker, so callers still see
-- only the rows their policies allow. Checked in a rolled-back transaction:
-- identical rows for all 12 callers (operator, company admin, managers,
-- board, owners, vendor, an unknown user); 1,014 ms -> 146 ms in total.
-- Speeds up receivable_summary, receivable_aging_buckets,
-- receivable_unit_totals and report_data_delinquency, which read it.

create or replace view public.aged_receivables
with (security_invoker = true) as
select c.unit_id,
       u.unit_number,
       b.name as building_name,
       a.name as association_name,
       a.id as association_id,
       c.id as charge_id,
       c.description,
       c.amount,
       c.due_date,
       coalesce(pa.paid, 0::numeric) as total_paid,
       c.amount - coalesce(pa.paid, 0::numeric) as balance_due,
       case
         when c.due_date >= current_date then 'current'::text
         when c.due_date >= (current_date - '30 days'::interval) then '1_30'::text
         when c.due_date >= (current_date - '60 days'::interval) then '31_60'::text
         when c.due_date >= (current_date - '90 days'::interval) then '61_90'::text
         else '90_plus'::text
       end as aging_bucket
  from public.charges c
  join public.units u on u.id = c.unit_id
  join public.buildings b on b.id = u.building_id
  join public.associations a on a.id = b.association_id
  left join (
    select charge_id, sum(amount_applied) as paid
      from public.payment_applications
     group by charge_id
  ) pa on pa.charge_id = c.id
 where c.amount - coalesce(pa.paid, 0::numeric) > 0::numeric;
