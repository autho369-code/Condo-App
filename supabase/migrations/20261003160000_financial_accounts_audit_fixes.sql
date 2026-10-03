-- Financial Accounts audit fixes.
-- 1. Bank deposits posted their lines to whatever association the form chose
--    (default none), so the deposit never showed in the bank's balance,
--    activity or reconciliation, which filter by the bank's association. A
--    deposit is now one atomic RPC that always uses the bank's association.
-- 2. A closed accounting period only blocked posting. A posted entry in a
--    closed month could still be unposted, re-dated, removed, or have its
--    lines changed. The guard now covers every change to a posted entry or
--    its lines in a closed month.
-- 3. The last reconciled date could move backwards (completing an older
--    statement after a newer one).
-- 4. Full bank account and routing numbers were readable by every signed-in
--    role with row access (board members included) through the API. They are
--    no longer selectable; screens show the last four digits, and check
--    printing reads the full numbers through a finance-only RPC.

-- ── 1. Bank deposits ─────────────────────────────────────────
create or replace function public.record_bank_deposit(
  p_bank_account_id uuid, p_credit_gl_id uuid, p_deposit_date date, p_amount numeric,
  p_memo text, p_received_from text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_bank public.bank_accounts;
  v_entry uuid;
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
begin
  select * into v_bank from public.bank_accounts where id = p_bank_account_id and archived_at is null;
  if not found or not public.can_manage_finance(v_bank.portfolio_id)
     or (v_bank.association_id is not null and not public.can_view_association_row(v_bank.association_id)) then
    raise exception 'Bank account not found' using errcode = 'P0002';
  end if;
  if v_bank.gl_account_id is null then
    raise exception '"%" has no linked GL account. Link one on the bank account before recording deposits.', v_bank.name using errcode = '22023';
  end if;
  if p_deposit_date is null then raise exception 'Deposit date is required' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Deposit amount must be greater than zero' using errcode = '22023'; end if;
  if p_credit_gl_id = v_bank.gl_account_id then
    raise exception 'The credited GL account must differ from the bank account''s GL account' using errcode = '22023';
  end if;
  if not exists (select 1 from public.gl_accounts g where g.id = p_credit_gl_id and g.portfolio_id = v_bank.portfolio_id and g.active
                   and (g.association_id is null or g.association_id is not distinct from v_bank.association_id)) then
    raise exception 'Choose a GL account of this bank account''s association' using errcode = '22023';
  end if;

  insert into public.journal_entries (portfolio_id, entry_date, description, memo, source_type, source_id, created_by, posted, posted_at)
  values (v_bank.portfolio_id, p_deposit_date,
          'Bank deposit — ' || v_bank.name || coalesce(' (from ' || nullif(btrim(coalesce(p_received_from, '')), '') || ')', ''),
          v_memo, 'bank_deposit', v_bank.id, auth.uid(), true, now())
  returning id into v_entry;
  insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
  values (v_entry, v_bank.association_id, v_bank.gl_account_id, round(p_amount, 2), 0, v_memo, 0),
         (v_entry, v_bank.association_id, p_credit_gl_id, 0, round(p_amount, 2), v_memo, 1);
  return v_entry;
end $$;
revoke all on function public.record_bank_deposit(uuid, uuid, date, numeric, text, text) from public, anon;
grant execute on function public.record_bank_deposit(uuid, uuid, date, numeric, text, text) to authenticated;

-- ── 2. Closed periods ────────────────────────────────────────
create or replace function public.app_period_closed(p_portfolio_id uuid, p_date date)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (select 1 from public.accounting_periods
                  where portfolio_id = p_portfolio_id and status = 'closed'
                    and fiscal_year = extract(year from p_date)::int
                    and period_month = extract(month from p_date)::int);
$$;
revoke all on function public.app_period_closed(uuid, date) from public, anon, authenticated;

create or replace function public.guard_closed_period_on_je()
returns trigger language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
begin
  -- Posting into a closed month.
  if tg_op in ('INSERT', 'UPDATE') and new.posted = true
     and (tg_op = 'INSERT' or old.posted is distinct from true or new.entry_date is distinct from old.entry_date
          or new.portfolio_id is distinct from old.portfolio_id)
     and public.app_period_closed(new.portfolio_id, new.entry_date) then
    raise exception 'cannot post journal entry to closed period %/%',
      extract(year from new.entry_date)::int, extract(month from new.entry_date)::int;
  end if;
  -- Changing or removing an entry already posted in a closed month.
  if tg_op in ('UPDATE', 'DELETE') and old.posted = true and public.app_period_closed(old.portfolio_id, old.entry_date)
     and (tg_op = 'DELETE' or new.posted is distinct from old.posted or new.entry_date is distinct from old.entry_date
          or new.portfolio_id is distinct from old.portfolio_id) then
    raise exception 'cannot change a journal entry in closed period %/%',
      extract(year from old.entry_date)::int, extract(month from old.entry_date)::int;
  end if;
  return coalesce(new, old);
end;
$function$;

create or replace trigger trg_guard_closed_period before insert or update or delete on public.journal_entries
  for each row execute function public.guard_closed_period_on_je();

create or replace function public.guard_closed_period_on_lines()
returns trigger language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
declare e record;
begin
  for e in
    select je.portfolio_id, je.entry_date from public.journal_entries je
     where je.posted and je.id in (case when tg_op <> 'INSERT' then old.entry_id end, case when tg_op <> 'DELETE' then new.entry_id end)
  loop
    if public.app_period_closed(e.portfolio_id, e.entry_date) then
      raise exception 'cannot change journal lines in closed period %/%',
        extract(year from e.entry_date)::int, extract(month from e.entry_date)::int;
    end if;
  end loop;
  return coalesce(new, old);
end;
$function$;
revoke all on function public.guard_closed_period_on_lines() from public, anon, authenticated;

create or replace trigger trg_guard_closed_period_lines before insert or update or delete on public.journal_lines
  for each row execute function public.guard_closed_period_on_lines();

-- ── 3. Last reconciled date only moves forward ─────────────────
create or replace function public.update_bank_account_reconciliation_date()
returns trigger language plpgsql set search_path to 'pg_catalog', 'public' as $function$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.bank_accounts
       set last_reconciliation_date = greatest(coalesce(last_reconciliation_date, new.statement_date), new.statement_date),
           updated_at = now()
     where id = new.bank_account_id;
  end if;
  return new;
end;
$function$;

-- ── 4. Bank account numbers ──────────────────────────────────
alter table public.bank_accounts
  add column if not exists account_number_last4 text generated always as (right(nullif(btrim(account_number), ''), 4)) stored,
  add column if not exists routing_number_last4 text generated always as (right(nullif(btrim(routing_number), ''), 4)) stored;

revoke all on public.bank_accounts from anon;
revoke select on public.bank_accounts from authenticated;
grant select (id, portfolio_id, association_id, name, bank_name, description, account_type, gl_account_id,
              use_printable_deposit_slip, address_street, address_city, address_state, address_zip, payments_enabled,
              auto_reconciliation, last_reconciliation_date, next_check_number, company_name, company_address,
              check_signature, entity_name, entity_address, archived_at, created_at, updated_at, purpose, fund_type,
              account_number_last4, routing_number_last4)
  on public.bank_accounts to authenticated;

-- Full numbers, for printing checks (MICR line). Finance staff only.
create or replace function public.bank_account_check_numbers(p_bank_account_id uuid)
returns table (routing_number text, account_number text)
language sql stable security definer set search_path = pg_catalog, public as $$
  select b.routing_number, b.account_number from public.bank_accounts b
   where b.id = p_bank_account_id and public.can_manage_finance(b.portfolio_id)
     and (b.association_id is null or public.can_view_association_row(b.association_id));
$$;
revoke all on function public.bank_account_check_numbers(uuid) from public, anon;
grant execute on function public.bank_account_check_numbers(uuid) to authenticated;
