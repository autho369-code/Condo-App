-- migration-reviewer on this PR: the Payment Plans report uses the plan's
-- own measure.
--
-- report_data_payment_plans summed every receipt since the plan started,
-- bounced ones included, and subtracted nothing, so "Paid to date",
-- "Remaining", "Installments paid", "Next due" and "Behind" disagreed with
-- the plan's status and the owner's schedule (payment_plan_schedule), which
-- use payment_plan_paid_amount. The report now uses payment_plan_paid_amount
-- too. Patched in place: the old expression must match exactly once.

do $$
declare
  v_def text := pg_get_functiondef('public.report_data_payment_plans(uuid, jsonb)'::regprocedure);
  v_old text := $o$(select coalesce(sum(pm.amount), 0) from public.payments pm
               where pm.unit_id = p.unit_id and pm.created_at >= p.created_at and (p.cancelled_at is null or pm.created_at <= p.cancelled_at) and coalesce(pm.method, '') <> 'credit') as paid$o$;
begin
  if position('payment_plan_paid_amount(p.id) as paid' in v_def) > 0 then
    return; -- already applied
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'report_data_payment_plans: paid expression not found exactly once';
  end if;
  execute replace(v_def, v_old, 'public.payment_plan_paid_amount(p.id) as paid');
end
$$;
