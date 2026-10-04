-- Fixes from the 2026-10-03 review of PRs #158–#171 (each reproduced in a
-- rolled-back transaction against production first).
--
-- 1. Late fees after a unit sale: the fee on a previous owner's overdue charge
--    was dated today — inside the buyer's ownership period — so the buyer's
--    credit or next payment paid the seller's fee. A previous owner's account
--    accrues no new late fees once a new owner has taken over.
-- 2. NSF fee when reversing a previous owner's payment landed on (and was paid
--    by) the buyer and bumped the buyer's NSF count. It is now refused with a
--    clear message; the reversal itself can still be done without the fee.
-- 3. One receipt could be matched to two bank-feed transactions (once through
--    its bank deposit, once through its own ledger line).
-- 4. Scoped managers could run the company-wide users_and_permissions and
--    data_diagnostics_summary reports.
-- 5. eCheck/ACH, check-run and homeowner-payable payments stored paid_at as
--    midnight UTC, which is the previous day in US time zones (a payment dated
--    January 1 counted toward the prior year's 1099). Stored at noon UTC now.
--    No paid bills or owner payables existed when this shipped.
-- 6. Editing or archiving a recurring journal entry did not check that the
--    caller manages every association on the EXISTING template.

-- ── 1 + 5 + 6: patch existing functions in place ───────────────────────────
create or replace function public.app_recurring_je_in_scope(p_template jsonb)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select not exists (
    select 1 from jsonb_array_elements(case when jsonb_typeof(p_template) = 'array' then p_template else '[]'::jsonb end) l
     where nullif(l->>'association_id', '') is not null
       and not public.can_manage_association((l->>'association_id')::uuid));
$$;
revoke all on function public.app_recurring_je_in_scope(jsonb) from public, anon, authenticated;

do $$
declare r record; d text; n text;
begin
  -- 1. assess_late_fee: skip charges from a previous owner's period.
  d := pg_get_functiondef('public.assess_late_fee'::regproc);
  n := replace(d, 'if v_balance <= 0 then return null; end if;',
    'if v_balance <= 0 then return null; end if;
  -- A previous owner''s charge: a new owner has taken over the unit since, so
  -- a fee dated today would fall in (and be paid from) the new owner''s period.
  if (public.app_ownership_bounds(v_charge.unit_id, v_charge.due_date)).period_to <= current_date then
    return null;
  end if;');
  if n = d then raise exception 'assess_late_fee patch target not found'; end if;
  execute n;

  -- 5. paid_at at noon UTC so the local calendar date matches the payment date.
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('record_bill_payment', 'record_check_run_legacy', 'pay_owner_payable') loop
    d := pg_get_functiondef(r.oid);
    n := replace(d, 'paid_at = p_payment_date::timestamptz',
                    'paid_at = (p_payment_date::timestamp + interval ''12 hours'') at time zone ''UTC''');
    if n = d then raise exception '% paid_at patch target not found', r.proname; end if;
    execute n;
  end loop;

  -- 6. recurring journal entries: the existing template must be in scope too.
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('save_recurring_journal_entry', 'archive_recurring_journal_entry') loop
    d := pg_get_functiondef(r.oid);
    n := replace(replace(d,
      'where id = v_id and portfolio_id = v_pid and archived_at is null;',
      'where id = v_id and portfolio_id = v_pid and archived_at is null and public.app_recurring_je_in_scope(template_lines);'),
      'where id = p_id and portfolio_id = v_pid and archived_at is null;',
      'where id = p_id and portfolio_id = v_pid and archived_at is null and public.app_recurring_je_in_scope(template_lines);');
    if n = d then raise exception '% scope patch target not found', r.proname; end if;
    execute n;
  end loop;

  -- 4. company-wide reports that ignore association_id.
  d := pg_get_functiondef('public.report_params_access_error'::regproc);
  n := replace(d, '''survey_results'', ''users'', ''login_audit'',',
                  '''survey_results'', ''users'', ''users_and_permissions'', ''data_diagnostics_summary'', ''login_audit'',');
  if n = d then raise exception 'report_params_access_error patch target not found'; end if;
  execute n;
end $$;

-- ── 2: NSF fee belongs to whoever owned the unit on the payment date ─────────
create or replace function public.post_nsf_fee(p_payment_id uuid, p_reason text default 'NSF - returned payment'::text)
returns uuid
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  payment_row public.payments;
  v_association_id uuid;
  v_portfolio_id uuid;
  fee_amount numeric(10,2);
  new_charge_id uuid;
  v_paid_on date;
begin
  select * into payment_row from public.payments where id = p_payment_id;
  if not found then raise exception 'payment not found'; end if;
  v_paid_on := coalesce(payment_row.payment_date, payment_row.created_at::date);

  -- A new owner has taken over since this payment: the fee (dated today) would
  -- be charged to — and auto-paid from — the new owner's account.
  if (public.app_ownership_bounds(payment_row.unit_id, v_paid_on)).period_to <= current_date then
    raise exception 'This payment was made by a previous owner of the unit, so the NSF fee can''t be charged to the current owner. Reverse the payment without the NSF fee.'
      using errcode = '22023';
  end if;

  select a.id, a.portfolio_id into v_association_id, v_portfolio_id
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = payment_row.unit_id;

  select coalesce(a.nsf_fee_amount_override, p.default_nsf_fee_amount) into fee_amount
    from public.associations a
    join public.portfolios p on p.id = a.portfolio_id
   where a.id = v_association_id;

  insert into public.charges (unit_id, charge_type, description, amount, due_date)
  values (payment_row.unit_id, 'nsf_fee', p_reason, fee_amount, current_date + 15)
  returning id into new_charge_id;

  update public.occupancies
     set nsf_count = nsf_count + 1, updated_at = now()
   where unit_id = payment_row.unit_id and status = 'current' and occupancy_type = 'owner';

  return new_charge_id;
end $$;
revoke all on function public.post_nsf_fee(uuid, text) from public, anon, authenticated;
grant execute on function public.post_nsf_fee(uuid, text) to service_role;

-- ── 3: a receipt is matched to the bank feed once — via its deposit OR its line
create or replace function public.guard_feed_line_not_deposited()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_type text; v_src uuid; v_deposit uuid;
begin
  if new.matched_journal_line_id is null
     or (tg_op = 'UPDATE' and new.matched_journal_line_id is not distinct from old.matched_journal_line_id) then
    return new;
  end if;
  select je.source_type, je.source_id into v_type, v_src
    from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
   where jl.id = new.matched_journal_line_id;
  if v_type = 'payment' then
    select bank_deposit_id into v_deposit from public.payments where id = v_src;
  elsif v_type = 'other_receipt' then
    select bank_deposit_id into v_deposit from public.other_receipts where id = v_src;
  end if;
  if v_deposit is not null and exists (select 1 from public.bank_deposits d where d.id = v_deposit and d.voided_at is null) then
    raise exception 'That receipt is part of a bank deposit. Match the bank transaction to the deposit instead.' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists trg_feed_line_not_deposited on public.bank_transactions;
create trigger trg_feed_line_not_deposited before insert or update of matched_journal_line_id on public.bank_transactions
  for each row execute function public.guard_feed_line_not_deposited();

create or replace function public.guard_deposit_receipt_not_feed_matched()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.bank_deposit_id is null or new.bank_deposit_id is not distinct from old.bank_deposit_id then
    return new;
  end if;
  if exists (select 1
               from public.bank_transactions bt
               join public.journal_lines jl on jl.id = bt.matched_journal_line_id
               join public.journal_entries je on je.id = jl.entry_id
              where je.source_type = tg_argv[0] and je.source_id = new.id) then
    raise exception 'A selected receipt is already matched to a bank transaction on its own, so it can''t be part of a deposit.' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists trg_payment_deposit_not_feed_matched on public.payments;
create trigger trg_payment_deposit_not_feed_matched before update of bank_deposit_id on public.payments
  for each row execute function public.guard_deposit_receipt_not_feed_matched('payment');
drop trigger if exists trg_other_receipt_deposit_not_feed_matched on public.other_receipts;
create trigger trg_other_receipt_deposit_not_feed_matched before update of bank_deposit_id on public.other_receipts
  for each row execute function public.guard_deposit_receipt_not_feed_matched('other_receipt');

notify pgrst, 'reload schema';
