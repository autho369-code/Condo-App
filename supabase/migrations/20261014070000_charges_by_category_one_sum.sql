-- Speed: v_charges_by_category adds up each charge's applications once.
--
-- Same pattern as v_charge_balances (20261014060000): the applied amount
-- was a correlated subquery written twice (total_applied and
-- outstanding_balance), and each copy evaluates the payment_applications
-- access rules separately. One LATERAL sum per charge does the same
-- arithmetic once. Same columns, types, order, grouping and values; still
-- security_invoker. Used by the Receivables page category totals.

create or replace view public.v_charges_by_category
with (security_invoker = true) as
select a.portfolio_id,
       a.id as association_id,
       a.name as association_name,
       cc.id as category_id,
       cc.name as category_name,
       cc.code as category_code,
       cc.is_assessment,
       cc.is_fee,
       date_trunc('month'::text, c.due_date::timestamp with time zone)::date as period_month,
       count(*) as charge_count,
       sum(c.amount) as total_charged,
       sum(coalesce(pa.paid, 0::numeric)) as total_applied,
       sum(c.amount - coalesce(pa.paid, 0::numeric)) as outstanding_balance
  from public.charges c
  join public.units u on u.id = c.unit_id
  join public.buildings b on b.id = u.building_id
  join public.associations a on a.id = b.association_id
  left join public.charge_categories cc on cc.id = c.charge_category_id
  left join lateral (
    select sum(p.amount_applied) as paid
      from public.payment_applications p
     where p.charge_id = c.id
  ) pa on true
 group by a.portfolio_id, a.id, a.name, cc.id, cc.name, cc.code, cc.is_assessment, cc.is_fee,
          (date_trunc('month'::text, c.due_date::timestamp with time zone));
