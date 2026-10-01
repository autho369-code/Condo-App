-- A/P transaction summary: total_paid is cash paid (bill amount minus vendor credits applied),
-- matching total_unpaid and the rest of the vendor-credit change.

do $$
declare
  v_fn regprocedure := 'public.report_data_ap_transaction_summary(uuid, jsonb)';
  v_def text := pg_get_functiondef(v_fn);
  v_old text := 'sum(b.amount) filter (where b.status::text = ''paid'') as total_paid';
begin
  if position(v_old in v_def) = 0 then
    raise exception 'vendor_credits_ap_summary_paid: report_data_ap_transaction_summary drifted';
  end if;
  execute replace(v_def, v_old, 'sum(b.amount - b.credit_applied) filter (where b.status::text = ''paid'') as total_paid');
end $$;
