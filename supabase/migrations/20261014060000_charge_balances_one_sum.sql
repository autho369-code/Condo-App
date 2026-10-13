-- Speed: v_charge_balances adds up each charge's applications once.
--
-- The view repeated the same correlated "sum of payment_applications for
-- this charge" four times (applied, balance, status, past due). Each copy
-- is its own subplan, and each subplan evaluates the access rules on
-- payment_applications, which build the caller's visible charge and
-- payment sets once per subplan (20261014000000). At 1,000 units x 36
-- months (rolled back) a scoped manager's one-unit read built eight sets of
-- ~36,000 ids: 420 ms. One LATERAL sum per charge does the same arithmetic
-- once. Same columns, types, order and values; still security_invoker (the
-- caller's access rules apply). v_unit_account_summary and
-- v_homeowner_ledgers read this view and get the same speed-up.

create or replace view public.v_charge_balances
with (security_invoker = true) as
select c.id as charge_id,
       c.unit_id,
       c.assessment_period_id,
       c.charge_type,
       c.description,
       c.amount as charged_amount,
       coalesce(pa.paid, 0::numeric) as applied_amount,
       c.amount - coalesce(pa.paid, 0::numeric) as balance_due,
       c.due_date,
       case
         when c.amount - coalesce(pa.paid, 0::numeric) <= 0::numeric then 'paid'::text
         when coalesce(pa.paid, 0::numeric) = 0::numeric then 'outstanding'::text
         else 'partial'::text
       end as payment_status,
       case
         when c.due_date < current_date and c.amount - coalesce(pa.paid, 0::numeric) > 0::numeric then true
         else false
       end as is_past_due
  from public.charges c
  left join lateral (
    select sum(p.amount_applied) as paid
      from public.payment_applications p
     where p.charge_id = c.id
  ) pa on true;
