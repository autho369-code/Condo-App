-- Speed at scale: delinquent_units reads each unit's past-due charges from
-- one (unit_id, due_date) index range.
--
-- delinquent_units looked up every unit's past-due charges through
-- v_charge_balances with "unit_id = x and due_date < local today". With only
-- single-column indexes the planner ANDed charges_unit_idx with
-- charges_due_idx, scanning ~6,000 due-date entries per unit: 520-690 ms at
-- 2,000 units / 6,000 charges for staff and the board, and it kept the
-- Receivables page totals at 1.1-1.6 s.
--
-- 1. Index charges (unit_id, due_date).
-- 2. The per-unit lookup reads charges directly and sums each charge's
--    payments by index (as aged_receivables does since 20261013040000)
--    instead of v_charge_balances, which repeats the payment sum three
--    times per charge. Same columns, same security_invoker.
-- Checked in a rolled-back transaction at that scale: identical rows for
-- manager, company admin, board, owner and a scoped manager; manager
-- 620 -> 246 ms, board 693 -> 315 ms.

create index if not exists charges_unit_due_idx on public.charges (unit_id, due_date);

create or replace view public.delinquent_units
with (security_invoker = true) as
select ub.unit_id,
       ub.unit_number,
       ub.building_id,
       ub.association_id,
       least(ub.balance, pd.past_due) as balance,
       pd.oldest_due
  from public.unit_balances ub
  join lateral (
    select sum(c.amount - coalesce(pa.paid, 0::numeric)) as past_due,
           min(c.due_date) as oldest_due
      from public.charges c
      left join lateral (
        select sum(p.amount_applied) as paid
          from public.payment_applications p
         where p.charge_id = c.id
      ) pa on true
     where c.unit_id = ub.unit_id
       and c.due_date < public.association_local_date(ub.association_id)
       and c.amount - coalesce(pa.paid, 0::numeric) > 0::numeric
  ) pd on true
 where ub.balance > 0::numeric
   and pd.oldest_due is not null
   and least(ub.balance, pd.past_due) > 0::numeric;
