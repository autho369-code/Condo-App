-- Codex on #345: recheck existing plans under the new measure.
--
-- 20261013200000 changed payment_plan_paid_amount. A plan already marked
-- completed under the old measure (for example one whose funding receipt
-- bounced while a later dues receipt kept the old total up) stays completed,
-- with its collection hold released, until some payment on the unit changes.
-- Run app_recheck_payment_plan once for every unit with an active or
-- completed plan, so each plan's status matches the measure now. Production
-- had no payment plans when this ran (nothing changed there); this keeps
-- any other database consistent. Re-runnable: a recheck of a plan that
-- already matches changes nothing.

do $$
declare
  v_unit uuid;
begin
  for v_unit in
    select distinct unit_id from public.payment_plans where status in ('active', 'completed')
  loop
    perform public.app_recheck_payment_plan(v_unit);
  end loop;
end
$$;
