-- General ledger / close deep check (package 2). Bug fixes only; no money
-- rule changes. Function bodies are the live definitions with the fix added.
--
-- 1. Lockbox batches/items, recurring journal entry templates and the
--    management-fee ledger are written only by database functions. Finance
--    staff could PATCH them directly: clear a posted check's payment_id (or
--    reset a fee month's bill_id, or move a template's next date back) and
--    post the same money twice, or point a check at a unit outside the batch's
--    association. No app code writes these tables directly.
-- 2. post_lockbox_batch re-checks that each check's unit is in the batch's
--    association and records the unit's CURRENT owner when it posts (the
--    owner saved at import/match may have sold the unit since).
-- 3. Recurring journal entries post once per template and date: a template
--    whose next date is moved back skips dates it already posted (an entry
--    that was reversed may post again).
-- 4. reverse_journal_entry / void_loan_payment date a default reversal by the
--    association's calendar, not UTC.
-- 5. Chart of accounts: an account any record uses (bank account, charge
--    category, bill, payment, loan, ...) can't change type, association or
--    company, and no used account can be deleted (deleting one silently
--    cleared its links). The edit page already refused this; a direct API
--    write did not.
-- 6. Company-wide GL defaults (the GL account map) and the management-fee
--    defaults are set by company-wide finance staff, like months and the fee
--    schedule: a manager limited to some associations can't change them.
-- 7. A finalized year-end package can only be superseded: it can't go back to
--    draft, and its snapshot, association, year, company, notes and who
--    generated/finalized it are frozen (a signature request can still be
--    attached, and superseding records who and why).
-- 8. Owners never read management agreements directly (staff notes; the old
--    policy matched owners by email across companies). The owner portal does
--    not show agreements.

-- 1. ---------------------------------------------------------------------
revoke insert, update, delete on public.lockbox_batches from anon, authenticated;
revoke insert, update, delete on public.lockbox_items from anon, authenticated;
revoke insert, update, delete on public.recurring_journal_entries from anon, authenticated;
revoke insert, update, delete on public.management_fees from anon, authenticated;

-- 2. ---------------------------------------------------------------------
create or replace function public.post_lockbox_batch(p_batch uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  b record;
  i record;
  v_payment uuid;
  v_owner uuid;
  v_posted int := 0;
  v_failed int := 0;
  v_open int;
begin
  -- Check access first, then lock: a caller can't hold a lock on another
  -- company's batch.
  select * into b from public.lockbox_batches where id = p_batch;
  if not found or not public.can_manage_finance(b.portfolio_id) or not public.can_manage_association(b.association_id) then
    raise exception 'Lockbox batch not found' using errcode = 'P0002';
  end if;
  select * into b from public.lockbox_batches where id = p_batch for update;
  if not found then raise exception 'Lockbox batch not found' using errcode = 'P0002'; end if;

  perform pg_advisory_xact_lock(hashtextextended('unit-apply:' || u.unit_id::text, 0))
     from (select distinct unit_id from public.lockbox_items
            where batch_id = p_batch and not rejected and payment_id is null and unit_id is not null
            order by unit_id) u;
  for i in select * from public.lockbox_items
            where batch_id = p_batch and not rejected and payment_id is null and unit_id is not null and check_amount_cents > 0
            order by row_no nulls last, created_at
  loop
    begin
      -- The check lands on a unit of the batch's own association only.
      if not exists (select 1 from public.units u join public.buildings bl on bl.id = u.building_id
                      where u.id = i.unit_id and bl.association_id = b.association_id and u.archived_at is null) then
        raise exception 'This unit is archived or not in the lockbox account''s association; choose the unit again' using errcode = '22023';
      end if;
      insert into public.payments (unit_id, amount, payment_date, method, reference, notes, bank_account_id, created_by)
      values (i.unit_id, i.check_amount_cents / 100.0, b.batch_date, 'check',
              coalesce('Check ' || i.check_number, 'Lockbox check'),
              btrim(concat_ws(' ' || chr(183) || ' ', 'Lockbox' || coalesce(' ' || b.deposit_reference, ''), i.payer_name, i.memo)),
              b.bank_account_id, auth.uid())
      returning id into v_payment;
      -- The payment belongs to the unit; show the owner of record now, not
      -- the one saved when the file was imported or matched.
      select occ.owner_id into v_owner from public.occupancies occ
       where occ.unit_id = i.unit_id and occ.status = 'current' and occ.occupancy_type = 'owner'
       order by occ.is_primary desc nulls last limit 1;
      update public.lockbox_items set payment_id = v_payment, owner_id = v_owner, posted_at = now(), post_error = null where id = i.id;
      v_posted := v_posted + 1;
    exception when others then
      update public.lockbox_items set post_error = left(sqlerrm, 300) where id = i.id;
      v_failed := v_failed + 1;
    end;
  end loop;

  select count(*) into v_open from public.lockbox_items where batch_id = p_batch and not rejected and payment_id is null;
  perform public.refresh_lockbox_batch_status(p_batch);
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (b.portfolio_id, 'lockbox_batch', p_batch, 'lockbox_posted', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('posted', v_posted, 'failed', v_failed, 'still_open', v_open));
  return jsonb_build_object('posted', v_posted, 'failed', v_failed, 'open', v_open);
end $function$;

-- 3. ---------------------------------------------------------------------
create or replace function public.generate_recurring_journal_entries_through(p_portfolio_id uuid, p_through date, p_scoped boolean)
 returns integer
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  t record;
  v_entry uuid;
  v_lines jsonb;
  v_date date;
  v_guard int;
  n integer := 0;
begin
  for t in
    select * from public.recurring_journal_entries
     where auto_generate and archived_at is null and next_post_date is not null and next_post_date <= p_through
       and (end_date is null or next_post_date <= end_date)
       and (p_portfolio_id is null or portfolio_id = p_portfolio_id)
     for update skip locked
  loop
    begin
      v_lines := public.app_normalize_je_lines(t.portfolio_id, t.template_lines, p_scoped);
      v_date := t.next_post_date;
      v_guard := 0;
      while v_date <= p_through and (t.end_date is null or v_date <= t.end_date) and v_guard < 400 loop
        -- Once per template and date: a date this template already posted
        -- (and that wasn't reversed) is skipped, so moving the next date back
        -- never posts the same month twice.
        if not exists (select 1 from public.journal_entries je
                        where je.source_type = 'recurring_je' and je.source_id = t.id and je.portfolio_id = t.portfolio_id
                          and je.entry_date = v_date and je.posted and je.reversed_by_entry_id is null) then
          insert into public.journal_entries (portfolio_id, entry_date, description, memo, source_type, source_id, created_by, posted)
          values (t.portfolio_id, v_date, left(t.name, 500), coalesce(nullif(btrim(t.memo), ''), t.name) || ' (recurring)',
                  'recurring_je', t.id, t.created_by, false)
          returning id into v_entry;
          insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
          select v_entry, (l->>'gl_account_id')::uuid, (l->>'association_id')::uuid, (l->>'debit')::numeric, (l->>'credit')::numeric,
                 l->>'memo', (ord - 1)::int
            from jsonb_array_elements(v_lines) with ordinality as x(l, ord);
          update public.journal_entries set posted = true, posted_at = now() where id = v_entry;
          n := n + 1;
        end if;
        v_date := public.recurring_next_date(v_date, t.frequency::text, t.interval_count);
        v_guard := v_guard + 1;
      end loop;
      update public.recurring_journal_entries
         set next_post_date = v_date, last_generated_at = now(), last_error = null, updated_at = now(),
             auto_generate = (t.end_date is null or v_date <= t.end_date)
       where id = t.id;
    exception when others then
      update public.recurring_journal_entries set last_error = left(sqlerrm, 500), updated_at = now() where id = t.id;
    end;
  end loop;
  return n;
end $function$;

-- 4. ---------------------------------------------------------------------
create or replace function public.reverse_journal_entry(p_id uuid, p_reversal_date date, p_reason text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  e public.journal_entries;
  v_rev uuid;
  v_assoc uuid;
begin
  select * into e from public.journal_entries where id = p_id for update;
  if not found or not public.can_manage_finance(e.portfolio_id)
     or exists (select 1 from public.journal_lines jl where jl.entry_id = e.id
                 and jl.association_id is not null and not public.can_manage_association(jl.association_id)) then
    raise exception 'Journal entry not found' using errcode = 'P0002';
  end if;
  if not e.posted then raise exception 'Only a posted entry can be reversed; discard the draft instead' using errcode = '22023'; end if;
  if e.reversed_by_entry_id is not null then raise exception 'This entry is already reversed' using errcode = '22023'; end if;
  if e.source_type = 'je_reversal' then raise exception 'This is a reversing entry; post a new entry instead' using errcode = '22023'; end if;
  if e.source_type is not null and e.source_type not in ('manual', 'adjustment', 'recurring_je', 'je_batch', 'bank_deposit') then
    raise exception 'This entry belongs to a %; void or reverse it from that record', replace(e.source_type, '_', ' ') using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason for the reversal' using errcode = '22023'; end if;

  -- With no date given, "today" is the association's today, not UTC's.
  select jl.association_id into v_assoc from public.journal_lines jl
   where jl.entry_id = e.id and jl.association_id is not null order by jl.sort_order, jl.id limit 1;

  insert into public.journal_entries (portfolio_id, entry_date, description, memo, reference_number, source_type, source_id, created_by, posted)
  values (e.portfolio_id,
          coalesce(p_reversal_date, case when v_assoc is not null then public.association_local_date(v_assoc, now()) end, current_date),
          left('Reversal: ' || coalesce(e.description, e.memo, 'journal entry'), 500),
          btrim(p_reason), e.reference_number, 'je_reversal', e.id, auth.uid(), false)
  returning id into v_rev;
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
  select v_rev, gl_account_id, association_id, credit_amount, debit_amount, 'Reversal: ' || coalesce(memo, ''), sort_order
    from public.journal_lines where entry_id = e.id;
  update public.journal_entries set posted = true, posted_at = now() where id = v_rev;
  update public.journal_entries set reversed_by_entry_id = v_rev where id = e.id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (e.portfolio_id, 'journal_entry', e.id, 'reversed', auth.uid(), jsonb_build_object('reversal_entry_id', v_rev, 'reason', btrim(p_reason)));
  return v_rev;
end $function$;

create or replace function public.void_loan_payment(p_payment_id uuid, p_reason text)
 returns void
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
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
  if exists (select 1 from public.loan_payments x where x.loan_id = p.loan_id and x.voided_at is null and x.id <> p.id
              and x.recorded_seq > p.recorded_seq) then
    raise exception 'Void the later payments on this loan first (newest first) so the balance and due date stay correct' using errcode = '22023';
  end if;

  -- The reversing entry is dated the association's today, not UTC's.
  insert into public.journal_entries (portfolio_id, entry_date, reference_number, description, memo, source_type, source_id, posted, created_by)
  values (p.portfolio_id, coalesce(public.association_local_date(p.association_id, now()), current_date),
          'VOID-' || coalesce(p.reference, left(p.id::text, 8)), 'Void: loan payment',
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
         next_payment_date = case when next_payment_date is not distinct from p.next_payment_date_after
                                  then p.previous_next_payment_date else next_payment_date end,
         updated_at = now()
   where id = p.loan_id;
  perform set_config('app.loan_ledger', '', true);

  update public.loan_payments
     set voided_at = now(), voided_by = auth.uid(), void_reason = left(v_reason, 500), void_journal_entry_id = v_entry
   where id = p.id;
end $function$;

-- 5. ---------------------------------------------------------------------
-- True when any record (other than role permissions and sub-accounts, which
-- are checked on their own) points at the account. Internal: triggers only.
create or replace function public.app_gl_account_referenced(p_gl_account_id uuid)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  r record;
  v_found boolean;
begin
  for r in
    select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = 'public.gl_accounts'::regclass
       and array_length(c.conkey, 1) = 1
       and c.conrelid not in ('public.gl_accounts'::regclass, 'public.gl_account_role_permissions'::regclass)
  loop
    execute format('select exists (select 1 from %s where %I = $1)', r.tbl, r.col)
      into v_found using p_gl_account_id;
    if v_found then
      return true;
    end if;
  end loop;
  return false;
end $function$;
revoke all on function public.app_gl_account_referenced(uuid) from public, anon, authenticated;

create or replace function public.guard_gl_account_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_parent public.gl_accounts;
  v_cursor uuid;
  v_hops int := 0;
  v_balance numeric;
begin
  if (tg_op = 'INSERT' or new.number is distinct from old.number or new.association_id is distinct from old.association_id)
     and exists (select 1 from public.gl_accounts o
                  where o.portfolio_id = new.portfolio_id and o.number = new.number and o.id <> new.id
                    and (o.association_id is null or new.association_id is null or o.association_id = new.association_id)) then
    raise exception 'Account number % is already used in this chart of accounts', new.number using errcode = '23505';
  end if;

  if tg_op = 'UPDATE' and new.portfolio_id is not distinct from old.portfolio_id
     and new.association_id is not distinct from old.association_id
     and new.account_type is not distinct from old.account_type
     and new.sub_account_of_id is not distinct from old.sub_account_of_id then
    null;
  elsif new.association_id is not null and not exists (
       select 1 from public.associations a where a.id = new.association_id and a.portfolio_id = new.portfolio_id) then
    raise exception 'That association is not in this company' using errcode = '22023';
  elsif new.sub_account_of_id is not null then
    select * into v_parent from public.gl_accounts where id = new.sub_account_of_id;
    if v_parent.id is null or v_parent.portfolio_id <> new.portfolio_id then
      raise exception 'Parent account not found' using errcode = '22023';
    end if;
    if v_parent.account_type <> new.account_type then
      raise exception 'A sub-account must have the same type as its parent' using errcode = '22023';
    end if;
    if v_parent.association_id is not null and v_parent.association_id is distinct from new.association_id then
      raise exception 'A sub-account must belong to its parent''s association' using errcode = '22023';
    end if;
    v_cursor := new.sub_account_of_id;
    while v_cursor is not null and v_hops < 50 loop
      if v_cursor = new.id then raise exception 'An account cannot be under its own sub-account' using errcode = '22023'; end if;
      select sub_account_of_id into v_cursor from public.gl_accounts where id = v_cursor;
      v_hops := v_hops + 1;
    end loop;
    if v_cursor is not null then
      raise exception 'This account hierarchy is too deep to check; choose a parent nearer the top' using errcode = '22023';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if (new.account_type is distinct from old.account_type or new.association_id is distinct from old.association_id
        or new.portfolio_id is distinct from old.portfolio_id)
       and exists (select 1 from public.journal_lines where gl_account_id = old.id) then
      raise exception 'This account has ledger entries; its type and association cannot change. Create a new account instead.' using errcode = '22023';
    end if;
    if (new.account_type is distinct from old.account_type or new.association_id is distinct from old.association_id
        or new.portfolio_id is distinct from old.portfolio_id)
       and exists (select 1 from public.gl_accounts where sub_account_of_id = old.id) then
      raise exception 'This account has sub-accounts; its type and association cannot change' using errcode = '22023';
    end if;
    -- Same rule as the edit page: an account any record uses (bank account,
    -- charge category, bill, loan, ...) keeps its type, association and company.
    if (new.account_type is distinct from old.account_type or new.association_id is distinct from old.association_id
        or new.portfolio_id is distinct from old.portfolio_id)
       and not public.app_is_repair_session()
       and public.app_gl_account_referenced(old.id) then
      raise exception 'This account is already used (a bank account, loan, charge category, bill or similar), so its type and association cannot change. Create a new account instead.' using errcode = '22023';
    end if;
    if old.active and not new.active and old.account_type::text in
         ('asset', 'liability', 'equity', 'cash', 'accounts_receivable', 'accounts_payable', 'fixed_asset') then
      select coalesce(sum(jl.debit_amount - jl.credit_amount), 0) into v_balance
        from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id and je.posted
       where jl.gl_account_id = old.id;
      if round(v_balance, 2) <> 0 then
        raise exception 'This account has a balance of %; move it to another account before deactivating', round(v_balance, 2) using errcode = '22023';
      end if;
    end if;
    if old.active and not new.active then
      if exists (select 1 from public.bank_accounts where gl_account_id = old.id and archived_at is null) then
        raise exception 'A bank account posts to this GL account; change the bank account first' using errcode = '22023';
      end if;
      if exists (select 1 from public.gl_account_map where gl_account_id = old.id) then
        raise exception 'This account is a default in the GL account map; choose another default first' using errcode = '22023';
      end if;
      if exists (select 1 from public.gl_accounts where sub_account_of_id = old.id and active) then
        raise exception 'This account has active sub-accounts; deactivate them first' using errcode = '22023';
      end if;
    end if;
  end if;
  return new;
end $function$;

-- Deleting an account any record uses would silently clear those links
-- (charges, payments, bills, bank accounts and categories are ON DELETE SET
-- NULL). Unused accounts can still be deleted; repairs (SQL editor, service
-- role) are not limited.
create or replace function public.guard_gl_account_delete()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
begin
  if public.app_is_repair_session() then
    return old;
  end if;
  if exists (select 1 from public.gl_accounts where sub_account_of_id = old.id) then
    raise exception 'This account has sub-accounts; it cannot be deleted' using errcode = '23503';
  end if;
  if public.app_gl_account_referenced(old.id) then
    raise exception 'This account is used by ledger entries or other records; mark it inactive instead of deleting it' using errcode = '23503';
  end if;
  return old;
end $function$;
revoke all on function public.guard_gl_account_delete() from public, anon, authenticated;

create or replace trigger trg_guard_gl_account_delete
  before delete on public.gl_accounts
  for each row execute function public.guard_gl_account_delete();

-- 6. ---------------------------------------------------------------------
create or replace function public.set_gl_account_map(p_key text, p_gl_account_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_pid uuid := public.current_portfolio_id();
  v_type text;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  -- The map is company-wide: it decides where every association posts.
  if public.manager_is_scoped() is true and not public.is_company_admin() and not public.is_platform_operator() then
    raise exception 'GL account defaults apply to the whole company. Ask a company admin or a manager who is not limited to specific associations.' using errcode = '42501';
  end if;
  if p_key is null or p_gl_account_id is null then raise exception 'Choose an account for this default' using errcode = '22023'; end if;
  select account_type::text into v_type from public.gl_accounts
   where id = p_gl_account_id and portfolio_id = v_pid and active and association_id is null;
  if v_type is null then
    raise exception 'Choose an active company-wide GL account' using errcode = '22023';
  end if;
  if not (
       (p_key = 'accounts_receivable' and v_type = 'accounts_receivable')
    or (p_key = 'accounts_payable' and v_type in ('accounts_payable', 'liability'))
    or (p_key in ('late_fee_income', 'default_income', 'assessment_income') and v_type in ('income', 'other_income'))
    or (p_key = 'undeposited_funds' and v_type in ('cash', 'asset'))) then
    raise exception 'That account type does not fit this default' using errcode = '22023';
  end if;
  if p_key = 'accounts_receivable' and exists (
       select 1 from public.gl_accounts g
        where g.portfolio_id = v_pid and g.account_type = 'accounts_receivable' and g.id <> p_gl_account_id
          and g.name not ilike '%allowance%'
          and round((select coalesce(sum(jl.debit_amount - jl.credit_amount), 0)
                       from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id and je.posted
                      where jl.gl_account_id = g.id), 2) <> 0) then
    raise exception 'Another A/R account still holds receivables; move that balance to this account with a journal entry before changing the default' using errcode = '22023';
  end if;
  insert into public.gl_account_map (portfolio_id, association_id, map_key, gl_account_id, updated_by)
  values (v_pid, null, p_key, p_gl_account_id, auth.uid())
  on conflict (portfolio_id, coalesce(association_id, '00000000-0000-0000-0000-000000000000'::uuid), map_key)
  do update set gl_account_id = excluded.gl_account_id, updated_by = excluded.updated_by, updated_at = now();
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (v_pid, 'gl_account_map', p_gl_account_id, 'mapped', auth.uid(), jsonb_build_object('key', p_key));
end $function$;

create or replace function public.run_management_fees(p_month date, p_association_ids uuid[], p_vendor_id uuid, p_gl_account_id uuid, p_bill_date date default null::date)
 returns integer
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_pid uuid := public.current_portfolio_id();
  v_ids uuid[];
  n integer;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if coalesce(cardinality(p_association_ids), 0) = 0 then raise exception 'Select at least one association' using errcode = '22023'; end if;
  select coalesce(array_agg(a.id), '{}') into v_ids
    from public.associations a
   where a.id = any (p_association_ids) and a.portfolio_id = v_pid and public.can_manage_association(a.id);

  n := public.app_bill_management_fees(v_pid, p_month, v_ids, p_vendor_id, p_gl_account_id, p_bill_date, auth.uid(), 'manual');

  -- The company's default vendor and account drive the automatic monthly
  -- run for every association; only company-wide finance staff change them
  -- (as with set_management_fee_schedule).
  if not (public.manager_is_scoped() is true and not public.is_company_admin()) then
    update public.portfolios set management_fee_vendor_id = p_vendor_id, management_fee_gl_account_id = p_gl_account_id
     where id = v_pid;
  end if;
  return n;
end $function$;

-- 7. ---------------------------------------------------------------------
create or replace function public.guard_year_end_package()
 returns trigger
 language plpgsql
 set search_path to 'pg_catalog', 'public'
as $function$
begin
  if old.status in ('finalized', 'superseded') then
    if new.snapshot is distinct from old.snapshot or new.snapshot_sha256 is distinct from old.snapshot_sha256
       or new.checklist is distinct from old.checklist or new.period_start is distinct from old.period_start
       or new.period_end is distinct from old.period_end or new.finalized_at is distinct from old.finalized_at
       or new.finalized_by is distinct from old.finalized_by or new.generated_by is distinct from old.generated_by
       or new.generated_at is distinct from old.generated_at or new.notes is distinct from old.notes
       or new.association_id is distinct from old.association_id or new.portfolio_id is distinct from old.portfolio_id
       or new.fiscal_year is distinct from old.fiscal_year then
      raise exception 'A finalized year-end package cannot be changed';
    end if;
    if old.status = 'superseded' and new.status <> 'superseded' then
      raise exception 'A superseded package cannot be reinstated';
    end if;
    if old.status = 'superseded' and (new.superseded_by is distinct from old.superseded_by
       or new.superseded_at is distinct from old.superseded_at or new.supersede_reason is distinct from old.supersede_reason) then
      raise exception 'A superseded year-end package cannot be changed';
    end if;
    if old.status = 'finalized' and new.status not in ('finalized', 'superseded') then
      raise exception 'A finalized year-end package cannot go back to draft; supersede it to prepare a revision';
    end if;
  end if;
  return new;
end;
$function$;

-- 8. ---------------------------------------------------------------------
alter policy "Owners read own agreements" on public.management_agreements
  to authenticated
  using (false);
