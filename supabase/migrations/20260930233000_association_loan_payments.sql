-- Association loans become real accounting records (AppFolio: Loans).
-- Before: a loan was a profile note with a hand-typed balance — payments were
-- never recorded, principal and interest never reached the ledger, and every
-- staff member in the company could read / edit every association's loans.
--
-- Now:
--  * loans carry their GL setup (liability account, interest expense account,
--    default bank account) and a payment frequency;
--  * record_loan_payment splits a payment into principal + interest (interest
--    = balance x rate / periods per year unless overridden), posts ONE balanced
--    journal entry (Dr liability, Dr interest expense, Cr bank), lowers the
--    balance and moves the next due date;
--  * void_loan_payment posts a reversing entry dated today and restores the
--    balance (and the due date when it was the latest payment);
--  * loans and payments are scoped to finance staff with association access.

-- No foreign keys on the new account columns on purpose: a second path
-- between already-related tables makes existing PostgREST embeds ambiguous
-- (PGRST201). association_loans_bind validates them instead.
alter table public.association_loans
  add column if not exists interest_gl_account_id uuid,
  add column if not exists bank_account_id uuid;

update public.association_loans set payment_frequency = 'monthly' where payment_frequency is null or payment_frequency not in ('monthly', 'quarterly', 'semi_annual', 'annual');
alter table public.association_loans alter column payment_frequency set default 'monthly';
alter table public.association_loans drop constraint if exists association_loans_payment_frequency_check;
alter table public.association_loans add constraint association_loans_payment_frequency_check
  check (payment_frequency in ('monthly', 'quarterly', 'semi_annual', 'annual'));
update public.association_loans set status = 'active' where status is null;

-- The association decides the company; GL and bank accounts must match it.
create or replace function public.association_loans_bind()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_portfolio uuid;
begin
  select portfolio_id into v_portfolio from public.associations where id = new.association_id;
  if v_portfolio is null then
    raise exception 'Association not found' using errcode = '23503';
  end if;
  new.portfolio_id := v_portfolio;
  if new.gl_account_id is not null and not exists (
       select 1 from public.gl_accounts g where g.id = new.gl_account_id and g.portfolio_id = v_portfolio
         and (g.association_id is null or g.association_id = new.association_id)) then
    raise exception 'The loan GL account must belong to this association''s company' using errcode = '22023';
  end if;
  if new.interest_gl_account_id is not null and not exists (
       select 1 from public.gl_accounts g where g.id = new.interest_gl_account_id and g.portfolio_id = v_portfolio
         and (g.association_id is null or g.association_id = new.association_id)) then
    raise exception 'The interest GL account must belong to this association''s company' using errcode = '22023';
  end if;
  if new.bank_account_id is not null and not exists (
       select 1 from public.bank_accounts b where b.id = new.bank_account_id and b.portfolio_id = v_portfolio
         and (b.association_id is null or b.association_id = new.association_id)) then
    raise exception 'The bank account must belong to this association' using errcode = '22023';
  end if;
  -- Once payments are on the ledger, the balance only moves through
  -- record_loan_payment / void_loan_payment (they set app.loan_ledger).
  if tg_op = 'UPDATE' and new.current_balance is distinct from old.current_balance
     and coalesce(current_setting('app.loan_ledger', true), '') <> 'on'
     and exists (select 1 from public.loan_payments p where p.loan_id = old.id) then
    raise exception 'This loan has recorded payments — its balance changes only by recording or voiding a payment' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists trg_association_loans_000_bind on public.association_loans;
create trigger trg_association_loans_000_bind before insert or update on public.association_loans
  for each row execute function public.association_loans_bind();

drop policy if exists mgr_assoc_scope on public.association_loans;
create policy mgr_assoc_scope on public.association_loans as restrictive for all to authenticated
  using (public.can_view_association_row(association_id));

create table if not exists public.loan_payments (
  id                        uuid primary key default gen_random_uuid(),
  loan_id                   uuid not null references public.association_loans(id) on delete restrict,
  portfolio_id              uuid not null,
  association_id            uuid not null,
  payment_date              date not null,
  amount                    numeric(14,2) not null check (amount > 0),
  principal                 numeric(14,2) not null check (principal >= 0),
  interest                  numeric(14,2) not null check (interest >= 0),
  balance_after             numeric(14,2) not null,
  previous_next_payment_date date,
  bank_account_id           uuid not null,  -- validated by record_loan_payment (no FK: see above)
  reference                 text check (reference is null or length(reference) <= 100),
  memo                      text check (memo is null or length(memo) <= 1000),
  journal_entry_id          uuid references public.journal_entries(id) on delete restrict,
  voided_at                 timestamptz,
  voided_by                 uuid,
  void_reason               text,
  void_journal_entry_id     uuid references public.journal_entries(id) on delete restrict,
  created_by                uuid,
  created_at                timestamptz not null default now(),
  check (principal + interest = amount)
);
create index if not exists loan_payments_loan_idx on public.loan_payments (loan_id, payment_date desc);

alter table public.loan_payments enable row level security;
revoke all on public.loan_payments from anon;
revoke insert, update, delete on public.loan_payments from authenticated;
grant select on public.loan_payments to authenticated;
drop policy if exists loan_payments_finance_read on public.loan_payments;
create policy loan_payments_finance_read on public.loan_payments for select to authenticated
  using (public.can_manage_finance(portfolio_id) or public.is_platform_operator());
drop policy if exists mgr_assoc_scope on public.loan_payments;
create policy mgr_assoc_scope on public.loan_payments as restrictive for all to authenticated
  using (public.can_view_association_row(association_id));

create or replace function public.loan_periods_per_year(p_frequency text)
returns integer language sql immutable set search_path = pg_catalog, public as $$
  select case p_frequency when 'quarterly' then 4 when 'semi_annual' then 2 when 'annual' then 1 else 12 end;
$$;

create or replace function public.record_loan_payment(
  p_loan_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_interest numeric,
  p_bank_account_id uuid,
  p_reference text,
  p_memo text
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  l public.association_loans;
  v_bank public.bank_accounts;
  v_amount numeric(14,2) := round(p_amount, 2);
  v_interest numeric(14,2);
  v_principal numeric(14,2);
  v_months integer;
  v_payment uuid;
  v_entry uuid;
  v_label text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to record loan payments' using errcode = '42501';
  end if;
  select * into l from public.association_loans where id = p_loan_id and archived_at is null for update;
  if l.id is null then
    raise exception 'Loan not found';
  end if;
  if not ((public.can_manage_finance(l.portfolio_id) and public.can_manage_association(l.association_id)) or public.is_platform_operator()) then
    raise exception 'You do not have accounting access to this association' using errcode = '42501';
  end if;
  if l.gl_account_id is null or l.interest_gl_account_id is null then
    raise exception 'Set the loan''s liability and interest expense GL accounts first' using errcode = '22023';
  end if;
  if coalesce(l.current_balance, 0) <= 0 then
    raise exception 'This loan has no balance left' using errcode = '22023';
  end if;
  if p_payment_date is null or p_payment_date > current_date + 31 then
    raise exception 'Enter a valid payment date' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Payment amount must be greater than zero' using errcode = '22023';
  end if;

  select * into v_bank from public.bank_accounts
   where id = coalesce(p_bank_account_id, l.bank_account_id) and archived_at is null
     and portfolio_id = l.portfolio_id and (association_id is null or association_id = l.association_id);
  if v_bank.id is null then
    raise exception 'Choose a bank account that belongs to this association' using errcode = '22023';
  end if;
  if v_bank.gl_account_id is null then
    raise exception 'Bank account "%" has no linked GL account', v_bank.name using errcode = '22023';
  end if;

  v_interest := coalesce(round(p_interest, 2),
                         round(l.current_balance * coalesce(l.interest_rate, 0) / 100 / public.loan_periods_per_year(l.payment_frequency), 2));
  if v_interest < 0 or v_interest > v_amount then
    raise exception 'Interest must be between $0 and the payment amount' using errcode = '22023';
  end if;
  v_principal := v_amount - v_interest;
  if v_principal > l.current_balance then
    raise exception 'Principal ($%) would exceed the remaining balance ($%) — lower the payment or record the payoff amount',
      to_char(v_principal, 'FM999,999,990.00'), to_char(l.current_balance, 'FM999,999,990.00') using errcode = '22023';
  end if;

  v_label := 'Loan payment — ' || left(l.lender, 120);
  insert into public.loan_payments (loan_id, portfolio_id, association_id, payment_date, amount, principal, interest, balance_after,
                                    previous_next_payment_date, bank_account_id, reference, memo, created_by)
  values (l.id, l.portfolio_id, l.association_id, p_payment_date, v_amount, v_principal, v_interest, l.current_balance - v_principal,
          l.next_payment_date, v_bank.id, nullif(left(btrim(coalesce(p_reference, '')), 100), ''), nullif(left(btrim(coalesce(p_memo, '')), 1000), ''), auth.uid())
  returning id into v_payment;

  insert into public.journal_entries (portfolio_id, entry_date, reference_number, description, memo, source_type, source_id, posted, created_by)
  values (l.portfolio_id, p_payment_date, nullif(left(btrim(coalesce(p_reference, '')), 100), ''), v_label,
          nullif(left(btrim(coalesce(p_memo, '')), 1000), ''), 'loan_payment', v_payment, false, auth.uid())
  returning id into v_entry;
  if v_principal > 0 then
    insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
    values (v_entry, l.gl_account_id, l.association_id, v_principal, 0, v_label || ' (principal)', 0);
  end if;
  if v_interest > 0 then
    insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
    values (v_entry, l.interest_gl_account_id, l.association_id, v_interest, 0, v_label || ' (interest)', 1);
  end if;
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
  values (v_entry, v_bank.gl_account_id, l.association_id, 0, v_amount, v_label, 2);
  update public.journal_entries set posted = true, posted_at = now() where id = v_entry;
  update public.loan_payments set journal_entry_id = v_entry where id = v_payment;

  v_months := 12 / public.loan_periods_per_year(l.payment_frequency);
  perform set_config('app.loan_ledger', 'on', true);
  update public.association_loans
     set current_balance = current_balance - v_principal,
         next_payment_date = case when current_balance - v_principal <= 0 then null
                                  when next_payment_date is null then null
                                  else (next_payment_date + make_interval(months => v_months))::date end,
         status = case when current_balance - v_principal <= 0 then 'paid_off' else coalesce(status, 'active') end,
         updated_at = now()
   where id = l.id;
  perform set_config('app.loan_ledger', '', true);
  return v_payment;
end $$;

create or replace function public.void_loan_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  p public.loan_payments;
  v_entry uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_latest boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in to void loan payments' using errcode = '42501';
  end if;
  select * into p from public.loan_payments where id = p_payment_id for update;
  if p.id is null then
    raise exception 'Payment not found';
  end if;
  if not ((public.can_manage_finance(p.portfolio_id) and public.can_manage_association(p.association_id)) or public.is_platform_operator()) then
    raise exception 'You do not have accounting access to this association' using errcode = '42501';
  end if;
  if p.voided_at is not null then
    raise exception 'This payment is already void' using errcode = '22023';
  end if;
  if v_reason is null then
    raise exception 'Enter a reason for voiding' using errcode = '22023';
  end if;
  perform 1 from public.association_loans where id = p.loan_id for update;

  insert into public.journal_entries (portfolio_id, entry_date, reference_number, description, memo, source_type, source_id, posted, created_by)
  values (p.portfolio_id, current_date, 'VOID-' || coalesce(p.reference, left(p.id::text, 8)), 'Void: loan payment',
          left(v_reason, 1000), 'loan_payment_void', p.id, false, auth.uid())
  returning id into v_entry;
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
  select v_entry, jl.gl_account_id, jl.association_id, jl.credit_amount, jl.debit_amount, 'Void: ' || coalesce(jl.memo, ''), jl.sort_order
    from public.journal_lines jl where jl.entry_id = p.journal_entry_id;
  update public.journal_entries set posted = true, posted_at = now() where id = v_entry;

  v_latest := not exists (select 1 from public.loan_payments x where x.loan_id = p.loan_id and x.voided_at is null
                            and x.id <> p.id and (x.created_at > p.created_at));
  perform set_config('app.loan_ledger', 'on', true);
  update public.association_loans
     set current_balance = current_balance + p.principal,
         status = case when status = 'paid_off' then 'active' else status end,
         next_payment_date = case when v_latest then p.previous_next_payment_date else next_payment_date end,
         updated_at = now()
   where id = p.loan_id;
  perform set_config('app.loan_ledger', '', true);

  update public.loan_payments
     set voided_at = now(), voided_by = auth.uid(), void_reason = left(v_reason, 500), void_journal_entry_id = v_entry
   where id = p.id;
end $$;

revoke all on function public.record_loan_payment(uuid, date, numeric, numeric, uuid, text, text) from public, anon;
revoke all on function public.void_loan_payment(uuid, text) from public, anon;
grant execute on function public.record_loan_payment(uuid, date, numeric, numeric, uuid, text, text) to authenticated;
grant execute on function public.void_loan_payment(uuid, text) to authenticated;
