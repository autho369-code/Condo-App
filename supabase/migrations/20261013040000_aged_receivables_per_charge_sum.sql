-- Speed at scale: aged_receivables looks up each charge's unit and sums its
-- payments by index, instead of joining whole tables.
--
-- With row-level security the planner cannot tell how many units survive
-- the policies and expects about one, so at scale it compared every charge
-- with every visible unit (2,000 units / 6,000 charges: 6 million join
-- comparisons) and joined the grouped payment sums the same way. Reads took
-- 450-950 ms for every staff role and the board, feeding Receivables, the
-- A/R aging report, autopay, receivable_summary, receivable_aging_buckets,
-- receivable_unit_totals and report_data_delinquency.
--
-- Now the unit, building and association come from a LATERAL lookup on the
-- charge's unit (units_pkey) and the payments from a LATERAL sum on
-- idx_payment_apps_charge, so the plan no longer depends on that estimate.
-- unit_id filters still narrow the charges first. Same columns in the same
-- order, same security_invoker, so callers see only the rows their policies
-- allow.
-- Checked in a rolled-back transaction at that scale: identical rows for
-- manager, company admin, operator, board, owner, vendor, a scoped manager
-- and an unknown user, and identical receivable_summary,
-- receivable_aging_buckets, receivable_unit_totals and receivables_page_totals
-- results. Manager: full read 771 -> 79 ms, first 1,000 sorted rows
-- 937 -> 394 ms, Receivables page 500 rows 511 -> 235 ms,
-- receivable_summary 1,109 -> 82 ms, aging buckets 746 -> 83 ms.

create or replace view public.aged_receivables
with (security_invoker = true) as
select c.unit_id,
       ua.unit_number,
       ua.building_name,
       ua.association_name,
       ua.association_id,
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
  join lateral (
    select u.unit_number,
           b.name as building_name,
           a.name as association_name,
           a.id as association_id
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id
     where u.id = c.unit_id
  ) ua on true
  left join lateral (
    select sum(p.amount_applied) as paid
      from public.payment_applications p
     where p.charge_id = c.id
  ) pa on true
 where c.amount - coalesce(pa.paid, 0::numeric) > 0::numeric;
