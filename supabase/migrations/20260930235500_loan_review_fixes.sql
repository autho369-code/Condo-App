-- #87 review fixes.
-- 1. Loans are finance records: every staff member could still create, edit
--    or archive them through the old al_staff_all policy. Staff with access
--    keep read access (loans appear on the association profile); writes now
--    need finance access (can_manage_finance) or an operator.
-- 2. Voiding goes newest-first. A payment can be voided only when no later
--    live payment exists, so the restored due date is always right.
-- 3. The loan's accounts must be the right kind and active: principal to an
--    active liability account, interest to an active expense account.
--    record_loan_payment re-checks both before posting.

drop policy if exists al_staff_all on public.association_loans;
drop policy if exists al_staff_read on public.association_loans;
create policy al_staff_read on public.association_loans for select to authenticated
  using ((public.is_any_staff() or public.is_company_admin()) and public.can_access_portfolio(portfolio_id));
drop policy if exists al_finance_write on public.association_loans;
create policy al_finance_write on public.association_loans for all to authenticated
  using (public.can_manage_finance(portfolio_id) or public.is_platform_operator())
  with check (public.can_manage_finance(portfolio_id) or public.is_platform_operator());

create or replace function public.association_loans_bind()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_portfolio uuid;
begin
  select portfolio_id into v_portfolio from public.associations where id = new.association_id;
  if v_portfolio is null then
    raise exception 'Association not found' using errcode = '23503';
  end if;
  new.portfolio_id := v_portfolio;
  if new.gl_account_id is not null and (tg_op = 'INSERT' or new.gl_account_id is distinct from old.gl_account_id) and not exists (
       select 1 from public.gl_accounts g where g.id = new.gl_account_id and g.portfolio_id = v_portfolio
         and (g.association_id is null or g.association_id = new.association_id)
         and g.account_type::text = 'liability' and coalesce(g.active, true)) then
    raise exception 'The loan account must be an active liability account of this association' using errcode = '22023';
  end if;
  if new.interest_gl_account_id is not null and (tg_op = 'INSERT' or new.interest_gl_account_id is distinct from old.interest_gl_account_id) and not exists (
       select 1 from public.gl_accounts g where g.id = new.interest_gl_account_id and g.portfolio_id = v_portfolio
         and (g.association_id is null or g.association_id = new.association_id)
         and g.account_type::text in ('expense', 'other_expense') and coalesce(g.active, true)) then
    raise exception 'The interest account must be an active expense account of this association' using errcode = '22023';
  end if;
  if new.bank_account_id is not null and (tg_op = 'INSERT' or new.bank_account_id is distinct from old.bank_account_id) and not exists (
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
  def := pg_get_functiondef('public.record_loan_payment(uuid, date, numeric, numeric, uuid, text, text)'::regprocedure);
  if def !~ 'if coalesce\(l\.current_balance, 0\) <= 0 then' then
    raise exception 'loan_review_fixes: record_loan_payment drifted';
  end if;
  def := regexp_replace(def, 'if coalesce\(l\.current_balance, 0\) <= 0 then',
    'if not exists (select 1 from public.gl_accounts g where g.id = l.gl_account_id and coalesce(g.active, true) and g.account_type::text = ''liability'')' || chr(10) ||
    '     or not exists (select 1 from public.gl_accounts g where g.id = l.interest_gl_account_id and coalesce(g.active, true) and g.account_type::text in (''expense'', ''other_expense'')) then' || chr(10) ||
    '    raise exception ''The loan''''s liability or interest account is inactive or the wrong type — fix the loan setup first'' using errcode = ''22023'';' || chr(10) ||
    '  end if;' || chr(10) ||
    '  if coalesce(l.current_balance, 0) <= 0 then');
  execute def;

  def := pg_get_functiondef('public.void_loan_payment(uuid, text)'::regprocedure);
  if def !~ 'perform 1 from public\.association_loans where id = p\.loan_id for update;' then
    raise exception 'loan_review_fixes: void_loan_payment drifted';
  end if;
  def := regexp_replace(def, 'perform 1 from public\.association_loans where id = p\.loan_id for update;',
    'perform 1 from public.association_loans where id = p.loan_id for update;' || chr(10) ||
    '  if exists (select 1 from public.loan_payments x where x.loan_id = p.loan_id and x.voided_at is null and x.id <> p.id' || chr(10) ||
    '              and (x.payment_date, x.created_at) > (p.payment_date, p.created_at)) then' || chr(10) ||
    '    raise exception ''Void the later payments on this loan first (newest first) so the balance and due date stay correct'' using errcode = ''22023'';' || chr(10) ||
    '  end if;');
  -- With newest-first voiding the voided payment is always the latest live one.
  def := regexp_replace(def, 'next_payment_date = case when v_latest then p\.previous_next_payment_date else next_payment_date end',
    'next_payment_date = p.previous_next_payment_date');
  execute def;
end $$;
