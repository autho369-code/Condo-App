-- Vendor credits, part 2: checks show the amount actually paid. The check
-- writing queue lists what is left on each bill after credits (and keeps the
-- bill total and credit for reference), and the issued-check record stores
-- the amount paid, not the bill total.
create or replace view public.v_check_writing_queue with (security_invoker = true) as
 SELECT pb.id AS bill_id,
    pb.portfolio_id,
    pb.vendor_id,
    v.name AS vendor_name,
    v.address_street,
    v.address_city,
    v.address_state,
    v.address_zip,
    pb.association_id,
    a.name AS association_name,
    (pb.amount - pb.credit_applied)::numeric(14,2) AS amount,
    pb.bill_date,
    pb.due_date,
    pb.memo,
    pb.gl_account_id,
    pb.bank_account_id,
    (CURRENT_DATE - pb.due_date) AS days_past_due,
    pb.amount AS bill_amount,
    pb.credit_applied
   FROM ((payable_bills pb
     JOIN vendors v ON ((v.id = pb.vendor_id)))
     LEFT JOIN associations a ON ((a.id = pb.association_id)))
  WHERE ((pb.archived_at IS NULL) AND (pb.status = 'approved'::payable_bill_status) AND (pb.paid_at IS NULL) AND (v.payment_type = 'check'::vendor_payment_type) AND (NOT v.is_auto_pay))
  ORDER BY pb.due_date, v.name;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.capture_issued_payable_check()'::regprocedure);
  if def !~ 'new\.check_number, new\.amount, new\.paid_at::date' then
    raise exception 'vendor_credits_check_amounts: capture_issued_payable_check drifted';
  end if;
  execute replace(def, 'new.check_number, new.amount, new.paid_at::date', 'new.check_number, new.amount - coalesce(new.credit_applied, 0), new.paid_at::date');
end $$;
