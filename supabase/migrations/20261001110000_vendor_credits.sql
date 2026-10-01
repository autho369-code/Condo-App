-- Vendor credits (AppFolio Payables task "Enter Credit").
--  * enter_vendor_credit posts Dr Accounts Payable / Cr the chosen GL account
--    (e.g. the expense that was refunded) for the association.
--  * apply_vendor_credit applies all or part of a credit to an approved,
--    unpaid bill of the same vendor and association: payable_bills.
--    credit_applied grows; a bill fully covered is marked paid with no check.
--    No entry is needed at application — the credit already debited A/P.
--  * The check run pays only what is left on each bill (amount -
--    credit_applied), and a bill with credits applied can't be voided.

alter table public.payable_bills add column if not exists credit_applied numeric(12, 2) not null default 0;
alter table public.payable_bills drop constraint if exists payable_bills_credit_applied_range;
alter table public.payable_bills add constraint payable_bills_credit_applied_range check (credit_applied >= 0 and credit_applied <= amount);

create table if not exists public.vendor_credits (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  credit_date date not null,
  gl_account_id uuid not null references public.gl_accounts(id),
  amount numeric(12, 2) not null check (amount > 0),
  applied_amount numeric(12, 2) not null default 0 check (applied_amount >= 0),
  reference text,
  memo text,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (applied_amount <= amount)
);
create index if not exists vendor_credits_vendor_idx on public.vendor_credits (vendor_id, association_id);

create table if not exists public.vendor_credit_applications (
  id uuid primary key default gen_random_uuid(),
  credit_id uuid not null references public.vendor_credits(id) on delete cascade,
  bill_id uuid not null references public.payable_bills(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  applied_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz not null default now()
);

alter table public.vendor_credits enable row level security;
alter table public.vendor_credit_applications enable row level security;
revoke all on public.vendor_credits, public.vendor_credit_applications from anon;
drop policy if exists vendor_credits_finance_read on public.vendor_credits;
create policy vendor_credits_finance_read on public.vendor_credits for select to authenticated
  using (public.can_manage_finance(portfolio_id) and public.can_manage_association(association_id));
drop policy if exists vendor_credit_applications_finance_read on public.vendor_credit_applications;
create policy vendor_credit_applications_finance_read on public.vendor_credit_applications for select to authenticated
  using (exists (select 1 from public.vendor_credits c where c.id = vendor_credit_applications.credit_id
                   and public.can_manage_finance(c.portfolio_id) and public.can_manage_association(c.association_id)));

-- Users can't change credit_applied directly (only through apply_vendor_credit).
do $$
declare def text;
begin
  def := pg_get_functiondef('public.validate_payable_bill_integrity()'::regprocedure);
  if def !~ 'or new\.approval_request_id is distinct from old\.approval_request_id\s+\) then' then
    raise exception 'vendor_credits: validate_payable_bill_integrity drifted';
  end if;
  def := regexp_replace(def, '(or new\.approval_request_id is distinct from old\.approval_request_id)(\s+\) then)',
                        '\1' || chr(10) || '      or new.credit_applied is distinct from old.credit_applied\2');
  def := regexp_replace(def, '(or new\.paid_at is not null or new\.check_number is not null)(\s+\) then)',
                        '\1' || chr(10) || '      or coalesce(new.credit_applied, 0) <> 0\2');
  execute def;
end $$;

-- The A/P account the check run uses, for one association.
create or replace function public.app_ap_account(p_portfolio_id uuid, p_association_id uuid)
returns uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select id from public.gl_accounts
   where portfolio_id = p_portfolio_id and active
     and (account_type = 'accounts_payable'::public.gl_account_type or account_type = 'liability'::public.gl_account_type)
     and (association_id is null or association_id = p_association_id)
     and (account_type = 'accounts_payable'::public.gl_account_type or number::text = '2000' or lower(name) = 'accounts payable')
   order by (association_id = p_association_id) desc nulls last, (number::text = '2000') desc,
            (account_type = 'accounts_payable'::public.gl_account_type) desc, id
   limit 1;
$$;
revoke all on function public.app_ap_account(uuid, uuid) from public, anon, authenticated;

create or replace function public.enter_vendor_credit(
  p_association_id uuid, p_vendor_id uuid, p_credit_date date, p_gl_account_id uuid, p_amount numeric, p_reference text, p_memo text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid;
  v_amt numeric := round(p_amount, 2);
  v_ap uuid;
  v_gl public.gl_accounts;
  v_vendor text;
  v_credit uuid;
  v_entry uuid;
begin
  select portfolio_id into v_pid from public.associations where id = p_association_id and archived_at is null;
  if v_pid is null or not public.can_manage_finance(v_pid) or not public.can_manage_association(p_association_id) then
    raise exception 'You do not have accounting access to this association' using errcode = '42501';
  end if;
  select name into v_vendor from public.vendors where id = p_vendor_id and portfolio_id = v_pid and archived_at is null;
  if v_vendor is null then raise exception 'Vendor not found' using errcode = '22023'; end if;
  if p_credit_date is null or p_credit_date > current_date + 31 or p_credit_date < date '2000-01-01' then
    raise exception 'Enter a valid credit date' using errcode = '22023';
  end if;
  if v_amt is null or v_amt <= 0 or v_amt > 10000000 then
    raise exception 'Enter an amount greater than zero' using errcode = '22023';
  end if;
  select * into v_gl from public.gl_accounts g where g.id = p_gl_account_id and g.portfolio_id = v_pid and coalesce(g.active, true)
     and (g.association_id is null or g.association_id = p_association_id);
  if v_gl.id is null or v_gl.account_type::text in ('cash', 'accounts_receivable', 'accounts_payable') then
    raise exception 'Choose the account the credit reduces (usually the original expense)' using errcode = '22023';
  end if;
  v_ap := public.app_ap_account(v_pid, p_association_id);
  if v_ap is null then raise exception 'No Accounts Payable account is set up for this association' using errcode = '22023'; end if;

  insert into public.vendor_credits (portfolio_id, association_id, vendor_id, credit_date, gl_account_id, amount, reference, memo, created_by)
  values (v_pid, p_association_id, p_vendor_id, p_credit_date, v_gl.id, v_amt,
          nullif(left(btrim(coalesce(p_reference, '')), 100), ''), nullif(left(btrim(coalesce(p_memo, '')), 1000), ''), auth.uid())
  returning id into v_credit;

  insert into public.journal_entries (portfolio_id, entry_date, reference_number, description, memo, source_type, source_id, posted, created_by)
  values (v_pid, p_credit_date, nullif(left(btrim(coalesce(p_reference, '')), 100), ''), left('Vendor credit — ' || v_vendor, 250),
          nullif(left(btrim(coalesce(p_memo, '')), 1000), ''), 'vendor_credit', v_credit, false, auth.uid())
  returning id into v_entry;
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
  values (v_entry, v_ap, p_association_id, v_amt, 0, left('Vendor credit — ' || v_vendor, 250), 0),
         (v_entry, v_gl.id, p_association_id, 0, v_amt, left('Vendor credit — ' || v_vendor, 250), 1);
  update public.journal_entries set posted = true, posted_at = now() where id = v_entry;
  update public.vendor_credits set journal_entry_id = v_entry where id = v_credit;
  return v_credit;
end $$;

create or replace function public.apply_vendor_credit(p_credit_id uuid, p_bill_id uuid, p_amount numeric)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  c public.vendor_credits;
  b public.payable_bills;
  v_amt numeric := round(p_amount, 2);
  v_left numeric;
begin
  select * into c from public.vendor_credits where id = p_credit_id for update;
  if c.id is null or not (public.can_manage_finance(c.portfolio_id) and public.can_manage_association(c.association_id)) then
    raise exception 'Credit not found' using errcode = '42501';
  end if;
  select * into b from public.payable_bills where id = p_bill_id for update;
  if b.id is null or b.vendor_id <> c.vendor_id or b.association_id is distinct from c.association_id or b.portfolio_id <> c.portfolio_id then
    raise exception 'Apply the credit to a bill from the same vendor and association' using errcode = '22023';
  end if;
  if b.status <> 'approved'::public.payable_bill_status or b.paid_at is not null or b.check_number is not null or b.archived_at is not null then
    raise exception 'Credits can only be applied to approved, unpaid bills' using errcode = '22023';
  end if;
  v_left := b.amount - b.credit_applied;
  if v_amt is null or v_amt <= 0 then raise exception 'Enter an amount greater than zero' using errcode = '22023'; end if;
  if v_amt > c.amount - c.applied_amount then raise exception 'Only % of this credit is left', c.amount - c.applied_amount using errcode = '22023'; end if;
  if v_amt > v_left then raise exception 'Only % is still owed on this bill', v_left using errcode = '22023'; end if;
  perform public.ensure_payable_bill_accrual(b.id);

  insert into public.vendor_credit_applications (credit_id, bill_id, amount, applied_by) values (c.id, b.id, v_amt, auth.uid());
  update public.vendor_credits set applied_amount = applied_amount + v_amt where id = c.id;
  if v_amt = v_left then
    update public.payable_bills
       set credit_applied = credit_applied + v_amt, status = 'paid'::public.payable_bill_status, paid_at = now(), updated_at = now()
     where id = b.id;
  else
    update public.payable_bills set credit_applied = credit_applied + v_amt, updated_at = now() where id = b.id;
  end if;
  return jsonb_build_object('applied', v_amt, 'bill_remaining', v_left - v_amt, 'credit_remaining', c.amount - c.applied_amount - v_amt);
end $$;

revoke all on function public.enter_vendor_credit(uuid, uuid, date, uuid, numeric, text, text) from public, anon;
grant execute on function public.enter_vendor_credit(uuid, uuid, date, uuid, numeric, text, text) to authenticated, service_role;
revoke all on function public.apply_vendor_credit(uuid, uuid, numeric) from public, anon;
grant execute on function public.apply_vendor_credit(uuid, uuid, numeric) to authenticated, service_role;

-- Check run pays what's left after credits.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.record_check_run_legacy(uuid, uuid[], integer, date)'::regprocedure);
  if def !~ 'if bill_row\.amount <= 0 then' or def !~ '\(payment_entry_id, bill_row\.association_id, ap_account_id, bill_row\.amount, 0, bill_row\.memo, 1\),'
     or def !~ '\(payment_entry_id, bill_row\.association_id, bank_row\.gl_account_id, 0, bill_row\.amount, bill_row\.memo, 2\);' then
    raise exception 'vendor_credits: record_check_run_legacy drifted';
  end if;
  def := replace(def, 'if bill_row.amount <= 0 then', 'if bill_row.amount - coalesce(bill_row.credit_applied, 0) <= 0 then');
  def := replace(def, '(payment_entry_id, bill_row.association_id, ap_account_id, bill_row.amount, 0, bill_row.memo, 1),',
                      '(payment_entry_id, bill_row.association_id, ap_account_id, bill_row.amount - coalesce(bill_row.credit_applied, 0), 0, bill_row.memo, 1),');
  def := replace(def, '(payment_entry_id, bill_row.association_id, bank_row.gl_account_id, 0, bill_row.amount, bill_row.memo, 2);',
                      '(payment_entry_id, bill_row.association_id, bank_row.gl_account_id, 0, bill_row.amount - coalesce(bill_row.credit_applied, 0), bill_row.memo, 2);');
  execute def;
end $$;

-- A bill with credits applied can't be voided (the credit would be stranded).
do $$
declare def text;
begin
  def := pg_get_functiondef('public.void_payable_bill(uuid)'::regprocedure);
  if def !~ '\nbegin\n' then
    raise exception 'vendor_credits: void_payable_bill drifted';
  end if;
  def := regexp_replace(def, '\nbegin\n',
    chr(10) || 'begin' || chr(10) ||
    '  if exists (select 1 from public.payable_bills where id = p_bill_id and credit_applied > 0) then' || chr(10) ||
    '    raise exception ''A vendor credit is applied to this bill — it can''''t be voided'' using errcode = ''22023'';' || chr(10) ||
    '  end if;' || chr(10));
  execute def;
end $$;
