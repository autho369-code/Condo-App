-- #87 review fixes, round 4.
-- 1. At posting time the liability and interest accounts must still belong to
--    the loan's company and association (an account can be reassigned later).
-- 2. Voiding restores the due date only if nobody corrected it after the
--    payment: each payment records the due date it produced, and the void
--    rewinds only when the loan still shows that date.

alter table public.loan_payments add column if not exists next_payment_date_after date;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.record_loan_payment(uuid, date, numeric, numeric, uuid, text, text)'::regprocedure);
  if def !~ 'where g\.id = l\.gl_account_id and coalesce\(g\.active, true\)'
     or def !~ 'where g\.id = l\.interest_gl_account_id and coalesce\(g\.active, true\)'
     or def !~ 'perform set_config\(''app\.loan_ledger'', '''', true\);\s*return v_payment;' then
    raise exception 'loan_review_fixes_4: record_loan_payment drifted';
  end if;
  def := regexp_replace(def, 'where g\.id = l\.gl_account_id and coalesce\(g\.active, true\)',
    'where g.id = l.gl_account_id and coalesce(g.active, true) and g.portfolio_id = l.portfolio_id and (g.association_id is null or g.association_id = l.association_id)');
  def := regexp_replace(def, 'where g\.id = l\.interest_gl_account_id and coalesce\(g\.active, true\)',
    'where g.id = l.interest_gl_account_id and coalesce(g.active, true) and g.portfolio_id = l.portfolio_id and (g.association_id is null or g.association_id = l.association_id)');
  def := regexp_replace(def, 'perform set_config\(''app\.loan_ledger'', '''', true\);(\s*)return v_payment;',
    'perform set_config(''app.loan_ledger'', '''', true);' || chr(10) ||
    '  update public.loan_payments set next_payment_date_after = (select a.next_payment_date from public.association_loans a where a.id = l.id) where id = v_payment;\1return v_payment;');
  execute def;

  def := pg_get_functiondef('public.void_loan_payment(uuid, text)'::regprocedure);
  if def !~ 'next_payment_date = p\.previous_next_payment_date' then
    raise exception 'loan_review_fixes_4: void_loan_payment drifted';
  end if;
  def := regexp_replace(def, 'next_payment_date = p\.previous_next_payment_date',
    'next_payment_date = case when next_payment_date is not distinct from p.next_payment_date_after' || chr(10) ||
    '                                  then p.previous_next_payment_date else next_payment_date end');
  execute def;
end $$;
