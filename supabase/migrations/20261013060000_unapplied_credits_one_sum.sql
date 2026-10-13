-- Speed at scale: v_unapplied_credits sums each payment's applications once.
--
-- The view summed payment_applications three times per payment in
-- correlated subqueries (applied, unapplied and the WHERE filter). At 2,000
-- units / 2,000 payments it took 170-340 ms for staff and the board and fed
-- receivable_unit_totals (Receivables page totals), apply_credits,
-- auto_apply_credit_on_new_charge, receivables_task_associations and
-- v_unit_account_summary.
--
-- Now one LATERAL sum per payment on idx_payment_apps_payment. Same columns,
-- order and types, same security_invoker.
-- Rolled-back dry run at that scale: identical rows for manager, company
-- admin, operator, board, owner, vendor and a scoped manager; manager
-- 271 -> 71 ms, board 341 -> 119 ms.

create or replace view public.v_unapplied_credits
with (security_invoker = true) as
select p.id as payment_id,
       p.unit_id,
       p.payment_date,
       p.amount,
       coalesce(pa.applied, 0::numeric) as applied_amount,
       p.amount - coalesce(pa.applied, 0::numeric) as unapplied_amount
  from public.payments p
  left join lateral (
    select sum(x.amount_applied) as applied
      from public.payment_applications x
     where x.payment_id = p.id
  ) pa on true
 where p.amount - coalesce(pa.applied, 0::numeric) > 0.005;
