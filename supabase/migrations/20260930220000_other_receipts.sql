-- Other receipts: money an association receives that is not a homeowner
-- payment (vendor refunds, insurance proceeds, laundry / cell-tower / parking
-- income, interest, reimbursements). AppFolio records these as "vendor
-- receipt" / "other receipt".
--
-- A receipt is split across one or more GL lines and posts ONE balanced journal
-- entry (Dr the bank account's GL, Cr each line's GL), in the same database
-- transaction. Voiding posts a reversing entry — history is never rewritten.
-- Writes go through record_other_receipt / void_other_receipt only; both check
-- finance access and association scope inside the function.

create table if not exists public.other_receipts (
  id                     uuid primary key default gen_random_uuid(),
  portfolio_id           uuid not null references public.portfolios(id) on delete cascade,
  association_id         uuid not null references public.associations(id) on delete restrict,
  bank_account_id        uuid not null references public.bank_accounts(id) on delete restrict,
  receipt_date           date not null,
  payer_type             text not null check (payer_type in ('vendor', 'other')),
  vendor_id              uuid references public.vendors(id) on delete set null,
  payer_name             text not null check (length(btrim(payer_name)) between 1 and 200),
  reference              text check (reference is null or length(reference) <= 100),
  memo                   text check (memo is null or length(memo) <= 1000),
  amount                 numeric(12,2) not null check (amount > 0),
  journal_entry_id       uuid references public.journal_entries(id) on delete restrict,
  voided_at              timestamptz,
  voided_by              uuid,
  void_reason            text,
  void_journal_entry_id  uuid references public.journal_entries(id) on delete restrict,
  created_by             uuid,
  created_at             timestamptz not null default now()
);
create index if not exists other_receipts_portfolio_date_idx on public.other_receipts (portfolio_id, receipt_date desc);
create index if not exists other_receipts_association_idx on public.other_receipts (association_id, receipt_date desc);
create index if not exists other_receipts_vendor_idx on public.other_receipts (vendor_id) where vendor_id is not null;

create table if not exists public.other_receipt_lines (
  id            uuid primary key default gen_random_uuid(),
  receipt_id    uuid not null references public.other_receipts(id) on delete cascade,
  gl_account_id uuid not null references public.gl_accounts(id) on delete restrict,
  amount        numeric(12,2) not null check (amount > 0),
  memo          text check (memo is null or length(memo) <= 300),
  sort_order    integer not null default 0
);
create index if not exists other_receipt_lines_receipt_idx on public.other_receipt_lines (receipt_id);

alter table public.other_receipts enable row level security;
alter table public.other_receipt_lines enable row level security;
revoke all on public.other_receipts, public.other_receipt_lines from anon;
revoke insert, update, delete on public.other_receipts, public.other_receipt_lines from authenticated;
grant select on public.other_receipts, public.other_receipt_lines to authenticated;

drop policy if exists other_receipts_finance_read on public.other_receipts;
create policy other_receipts_finance_read on public.other_receipts for select to authenticated
  using (public.can_manage_finance(portfolio_id) or public.is_platform_operator());
drop policy if exists mgr_assoc_scope on public.other_receipts;
create policy mgr_assoc_scope on public.other_receipts as restrictive for all to authenticated
  using (public.can_view_association_row(association_id));

drop policy if exists other_receipt_lines_read on public.other_receipt_lines;
create policy other_receipt_lines_read on public.other_receipt_lines for select to authenticated
  using (exists (select 1 from public.other_receipts r where r.id = other_receipt_lines.receipt_id));

create or replace function public.record_other_receipt(
  p_association_id uuid,
  p_bank_account_id uuid,
  p_receipt_date date,
  p_payer_type text,
  p_vendor_id uuid,
  p_payer_name text,
  p_reference text,
  p_memo text,
  p_lines jsonb
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_portfolio uuid;
  v_bank public.bank_accounts;
  v_vendor public.vendors;
  v_payer text := nullif(btrim(coalesce(p_payer_name, '')), '');
  v_total numeric(12,2) := 0;
  v_line jsonb;
  v_gl public.gl_accounts;
  v_amt numeric;
  v_receipt uuid;
  v_entry uuid;
  v_i integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in to record receipts' using errcode = '42501';
  end if;
  select portfolio_id into v_portfolio from public.associations where id = p_association_id and archived_at is null;
  if v_portfolio is null then
    raise exception 'Association not found';
  end if;
  if not ((public.can_manage_finance(v_portfolio) and public.can_manage_association(p_association_id))
          or public.is_platform_operator()) then
    raise exception 'You do not have accounting access to this association' using errcode = '42501';
  end if;
  if p_receipt_date is null or p_receipt_date > current_date + 31 or p_receipt_date < date '2000-01-01' then
    raise exception 'Enter a valid receipt date';
  end if;

  select * into v_bank from public.bank_accounts where id = p_bank_account_id and archived_at is null;
  if v_bank.id is null or v_bank.portfolio_id <> v_portfolio
     or (v_bank.association_id is not null and v_bank.association_id <> p_association_id) then
    raise exception 'That bank account does not belong to this association';
  end if;
  if v_bank.gl_account_id is null then
    raise exception 'Bank account "%" has no linked GL account. Link one on the bank account first.', v_bank.name;
  end if;

  if p_payer_type not in ('vendor', 'other') then
    raise exception 'Choose who the money came from';
  end if;
  if p_payer_type = 'vendor' then
    select * into v_vendor from public.vendors where id = p_vendor_id and portfolio_id = v_portfolio;
    if v_vendor.id is null then
      raise exception 'Vendor not found';
    end if;
    v_payer := coalesce(v_payer, v_vendor.name);
  elsif p_vendor_id is not null then
    raise exception 'Only vendor receipts can name a vendor';
  end if;
  if v_payer is null then
    raise exception 'Enter who the money came from';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line';
  end if;
  if jsonb_array_length(p_lines) > 20 then
    raise exception 'A receipt can have at most 20 lines';
  end if;

  insert into public.other_receipts (portfolio_id, association_id, bank_account_id, receipt_date, payer_type, vendor_id,
                                     payer_name, reference, memo, amount, created_by)
  values (v_portfolio, p_association_id, v_bank.id, p_receipt_date, p_payer_type,
          case when p_payer_type = 'vendor' then v_vendor.id end, left(v_payer, 200),
          nullif(left(btrim(coalesce(p_reference, '')), 100), ''), nullif(left(btrim(coalesce(p_memo, '')), 1000), ''),
          0.01, auth.uid())
  returning id into v_receipt;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_i := v_i + 1;
    begin
      v_amt := round((v_line ->> 'amount')::numeric, 2);
    exception when others then
      raise exception 'Line %: enter a valid amount', v_i;
    end;
    if v_amt is null or v_amt <= 0 or v_amt > 10000000 then
      raise exception 'Line %: amount must be greater than zero', v_i;
    end if;
    select * into v_gl from public.gl_accounts
     where id = nullif(v_line ->> 'gl_account_id', '')::uuid and portfolio_id = v_portfolio and coalesce(active, true);
    if v_gl.id is null then
      raise exception 'Line %: GL account not found', v_i;
    end if;
    if v_gl.id = v_bank.gl_account_id or v_gl.account_type::text in ('cash', 'accounts_receivable') then
      raise exception 'Line %: % can''t be credited here — homeowner payments are recorded as homeowner receipts and bank moves as transfers', v_i, v_gl.name;
    end if;
    insert into public.other_receipt_lines (receipt_id, gl_account_id, amount, memo, sort_order)
    values (v_receipt, v_gl.id, v_amt, nullif(left(btrim(coalesce(v_line ->> 'memo', '')), 300), ''), v_i);
    v_total := v_total + v_amt;
  end loop;

  update public.other_receipts set amount = v_total where id = v_receipt;

  insert into public.journal_entries (portfolio_id, entry_date, reference_number, description, memo, source_type, source_id, posted, created_by)
  values (v_portfolio, p_receipt_date, nullif(left(btrim(coalesce(p_reference, '')), 100), ''),
          'Receipt from ' || left(v_payer, 150), nullif(left(btrim(coalesce(p_memo, '')), 1000), ''),
          'other_receipt', v_receipt, false, auth.uid())
  returning id into v_entry;

  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
  values (v_entry, v_bank.gl_account_id, p_association_id, v_total, 0, 'Receipt from ' || left(v_payer, 150), 0);
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
  select v_entry, l.gl_account_id, p_association_id, 0, l.amount, coalesce(l.memo, 'Receipt from ' || left(v_payer, 150)), l.sort_order
    from public.other_receipt_lines l where l.receipt_id = v_receipt;

  update public.journal_entries set posted = true, posted_at = now() where id = v_entry;
  update public.other_receipts set journal_entry_id = v_entry where id = v_receipt;
  return v_receipt;
end $$;

create or replace function public.void_other_receipt(p_receipt_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  r public.other_receipts;
  v_entry uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Sign in to void receipts' using errcode = '42501';
  end if;
  select * into r from public.other_receipts where id = p_receipt_id for update;
  if r.id is null then
    raise exception 'Receipt not found';
  end if;
  if not ((public.can_manage_finance(r.portfolio_id) and public.can_manage_association(r.association_id))
          or public.is_platform_operator()) then
    raise exception 'You do not have accounting access to this association' using errcode = '42501';
  end if;
  if r.voided_at is not null then
    raise exception 'This receipt is already void';
  end if;
  if v_reason is null then
    raise exception 'Enter a reason for voiding';
  end if;

  -- Reverse on today's date so a closed month stays closed.
  insert into public.journal_entries (portfolio_id, entry_date, reference_number, description, memo, source_type, source_id, posted, created_by)
  values (r.portfolio_id, current_date, 'VOID-' || coalesce(r.reference, left(r.id::text, 8)),
          'Void: receipt from ' || left(r.payer_name, 150), left(v_reason, 1000), 'other_receipt_void', r.id, false, auth.uid())
  returning id into v_entry;
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
  select v_entry, jl.gl_account_id, jl.association_id, jl.credit_amount, jl.debit_amount, 'Void: ' || coalesce(jl.memo, ''), jl.sort_order
    from public.journal_lines jl where jl.entry_id = r.journal_entry_id;
  update public.journal_entries set posted = true, posted_at = now() where id = v_entry;

  update public.other_receipts
     set voided_at = now(), voided_by = auth.uid(), void_reason = left(v_reason, 500), void_journal_entry_id = v_entry
   where id = r.id;
end $$;

revoke all on function public.record_other_receipt(uuid, uuid, date, text, uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.void_other_receipt(uuid, text) from public, anon;
grant execute on function public.record_other_receipt(uuid, uuid, date, text, uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.void_other_receipt(uuid, text) to authenticated;
