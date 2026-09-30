-- #87 review fixes, round 2.
-- 1. Newest-first voiding follows the order payments were RECORDED (that is
--    the order the loan's balance and due date changed), not payment date.
-- 2. Moving a loan to another association re-checks every account binding.
-- 3. The bank account's linked GL must be an active cash account of the same
--    association (or company-wide) before a payment posts to it.

create or replace function public.association_loans_bind()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_portfolio uuid;
  v_moved boolean;
begin
  select portfolio_id into v_portfolio from public.associations where id = new.association_id;
  if v_portfolio is null then
    raise exception 'Association not found' using errcode = '23503';
  end if;
  new.portfolio_id := v_portfolio;
  v_moved := tg_op = 'INSERT' or new.association_id is distinct from old.association_id;
  if new.gl_account_id is not null and (v_moved or new.gl_account_id is distinct from old.gl_account_id) and not exists (
       select 1 from public.gl_accounts g where g.id = new.gl_account_id and g.portfolio_id = v_portfolio
         and (g.association_id is null or g.association_id = new.association_id)
         and g.account_type::text = 'liability' and coalesce(g.active, true)) then
    raise exception 'The loan account must be an active liability account of this association' using errcode = '22023';
  end if;
  if new.interest_gl_account_id is not null and (v_moved or new.interest_gl_account_id is distinct from old.interest_gl_account_id) and not exists (
       select 1 from public.gl_accounts g where g.id = new.interest_gl_account_id and g.portfolio_id = v_portfolio
         and (g.association_id is null or g.association_id = new.association_id)
         and g.account_type::text in ('expense', 'other_expense') and coalesce(g.active, true)) then
    raise exception 'The interest account must be an active expense account of this association' using errcode = '22023';
  end if;
  if new.bank_account_id is not null and (v_moved or new.bank_account_id is distinct from old.bank_account_id) and not exists (
       select 1 from public.bank_accounts b where b.id = new.bank_account_id and b.portfolio_id = v_portfolio
         and (b.association_id is null or b.association_id = new.association_id) and b.archived_at is null) then
    raise exception 'The bank account must belong to this association' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.current_balance is distinct from old.current_balance
     and coalesce(current_setting('app.loan_ledger', true), '') <> 'on'
     and exists (select 1 from public.loan_payments p where p.loan_id = old.id) then
    raise exception 'This loan has recorded payments — its balance changes only by recording or voiding a payment' using errcode = '22023';
  end if;
  return new;
end $$;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.void_loan_payment(uuid, text)'::regprocedure);
  if def !~ 'and \(x\.payment_date, x\.created_at\) > \(p\.payment_date, p\.created_at\)' then
    raise exception 'loan_review_fixes_2: void_loan_payment drifted';
  end if;
  def := regexp_replace(def, 'and \(x\.payment_date, x\.created_at\) > \(p\.payment_date, p\.created_at\)',
    'and (x.created_at, x.id) > (p.created_at, p.id)');
  execute def;

  def := pg_get_functiondef('public.record_loan_payment(uuid, date, numeric, numeric, uuid, text, text)'::regprocedure);
  if def !~ 'has no linked GL account'', v_bank\.name using errcode = ''22023'';\s*end if;' then
    raise exception 'loan_review_fixes_2: record_loan_payment drifted';
  end if;
  def := regexp_replace(def, '(has no linked GL account'', v_bank\.name using errcode = ''22023'';\s*end if;)',
    '\1' || chr(10) ||
    '  if not exists (select 1 from public.gl_accounts g where g.id = v_bank.gl_account_id and g.portfolio_id = l.portfolio_id' || chr(10) ||
    '                   and (g.association_id is null or g.association_id = l.association_id)' || chr(10) ||
    '                   and g.account_type::text = ''cash'' and coalesce(g.active, true)) then' || chr(10) ||
    '    raise exception ''Bank account "%" is linked to a GL account that is inactive, not a cash account, or belongs to another association'', v_bank.name using errcode = ''22023'';' || chr(10) ||
    '  end if;');
  execute def;
end $$;
