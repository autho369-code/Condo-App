-- Review fixes for recurring bills / journal entries:
-- 1. Auto-approved recurring bills now post the same accrual as a manual
--    approval (Dr expense / Cr Accounts Payable on the bill date), so expenses
--    and payables show in the statements before the check is written.
--    ensure_payable_bill_accrual() is callable by the scheduler (no JWT) and
--    service role; signed-in callers still need finance permission.
-- 2. Recurring journal lines must use a GL account that is company-wide or
--    belongs to the line's association.
-- 3. "daily" stays a valid cadence so editing an old daily template keeps it.
-- 4. BUG FIX (found while testing): bill approval and the check run looked for
--    Accounts Payable only among account_type = 'liability', but charts created
--    by the app store AP as account_type = 'accounts_payable' (2000). Approving
--    any bill and writing checks failed with "No active Accounts Payable GL
--    account". Both now accept either type, preferring accounts_payable / 2000.

create or replace function public.ensure_payable_bill_accrual(p_bill_id uuid)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  bill_row public.payable_bills;
  ap_account_id uuid;
  entry_id uuid;
begin
  select * into bill_row from public.payable_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found'; end if;
  -- No JWT role = pg_cron / internal job; service_role = trusted server code.
  if coalesce(auth.role(), '') not in ('', 'service_role') and not public.can_manage_finance(bill_row.portfolio_id) then
    raise exception 'Permission denied';
  end if;
  if bill_row.status not in ('approved'::public.payable_bill_status, 'paid'::public.payable_bill_status) then
    raise exception 'Bill must be approved before posting';
  end if;
  if bill_row.association_id is null or bill_row.gl_account_id is null then
    raise exception 'Bill requires an association and expense GL account before posting';
  end if;

  select id into entry_id from public.journal_entries
   where source_type = 'payable_bill' and source_id = p_bill_id;
  if found then return entry_id; end if;

  perform 1 from public.gl_accounts
   where id = bill_row.gl_account_id
     and portfolio_id = bill_row.portfolio_id
     and active
     and (association_id is null or association_id = bill_row.association_id);
  if not found then raise exception 'Bill expense GL account is not active in this portfolio/association'; end if;

  select id into ap_account_id from public.gl_accounts
   where portfolio_id = bill_row.portfolio_id
     and active
     and (account_type = 'accounts_payable'::public.gl_account_type
          or (account_type = 'liability'::public.gl_account_type
              and (number::text = '2000' or lower(name) = 'accounts payable')))
     and (association_id is null or association_id = bill_row.association_id)
   order by (association_id = bill_row.association_id) desc nulls last,
            (number::text = '2000') desc, (lower(name) = 'accounts payable') desc,
            (account_type = 'accounts_payable'::public.gl_account_type) desc, number, id
   limit 1;
  if ap_account_id is null then raise exception 'No active Accounts Payable GL account is configured'; end if;

  insert into public.journal_entries (
    portfolio_id, entry_date, description, memo, reference_number,
    source_type, source_id, created_by, posted, posted_at
  ) values (
    bill_row.portfolio_id, bill_row.bill_date,
    'Bill accrued: ' || coalesce(bill_row.bill_number, p_bill_id::text), bill_row.memo,
    bill_row.bill_number, 'payable_bill', p_bill_id, coalesce(auth.uid(), bill_row.created_by), true, now()
  ) returning id into entry_id;

  insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
  values
    (entry_id, bill_row.association_id, bill_row.gl_account_id, bill_row.amount, 0, bill_row.memo, 1),
    (entry_id, bill_row.association_id, ap_account_id, 0, bill_row.amount, bill_row.memo, 2);
  return entry_id;
end $$;
revoke all on function public.ensure_payable_bill_accrual(uuid) from public, anon;

create or replace function public.generate_recurring_bills()
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  t record;
  v_date date;
  v_guard integer;
  n integer := 0;
  v_mode text;
  v_threshold numeric;
  v_needs_board boolean;
  v_bill uuid;
begin
  for t in
    select * from public.recurring_bills
     where auto_generate and archived_at is null and next_post_date is not null
       and next_post_date <= current_date
       and (end_date is null or next_post_date <= end_date)
  loop
    begin
      v_date := t.next_post_date;
      v_guard := 0;
      v_mode := null;
      v_threshold := null;
      select s.sends_bills_to_board, s.bills_threshold into v_mode, v_threshold
        from public.board_approval_settings s where s.association_id = t.association_id;
      v_needs_board := coalesce(t.association_id is not null and (coalesce(v_mode, 'never') = 'always'
                       or (v_mode = 'over_threshold' and t.amount >= coalesce(v_threshold, 0))), false);

      while v_date <= current_date and (t.end_date is null or v_date <= t.end_date) and v_guard < 12 loop
        v_bill := null;
        insert into public.payable_bills (
          portfolio_id, vendor_id, association_id, gl_account_id, bank_account_id,
          bill_date, due_date, amount, memo, status, approval_required, approved_at,
          created_by, recurring_bill_id)
        values (
          t.portfolio_id, t.vendor_id, t.association_id, t.gl_account_id, t.bank_account_id,
          v_date, v_date + t.due_days, t.amount,
          coalesce(nullif(btrim(t.memo), ''), t.name) || ' — ' || to_char(v_date, 'Mon YYYY'),
          case when v_needs_board then 'draft' else 'approved' end::public.payable_bill_status,
          v_needs_board,
          case when v_needs_board then null else now() end,
          t.created_by, t.id)
        on conflict (recurring_bill_id, bill_date) where recurring_bill_id is not null do nothing
        returning id into v_bill;
        if v_bill is not null then
          n := n + 1;
          -- Same accrual a manual approval posts (Dr expense / Cr AP).
          if not v_needs_board then perform public.ensure_payable_bill_accrual(v_bill); end if;
        end if;
        v_date := public.recurring_next_date(v_date, t.frequency::text, t.interval_count);
        v_guard := v_guard + 1;
      end loop;

      update public.recurring_bills
         set next_post_date = v_date, last_generated_at = now(), last_error = null, updated_at = now()
       where id = t.id;
    exception when others then
      update public.recurring_bills set last_error = left(sqlerrm, 500), updated_at = now() where id = t.id;
    end;
  end loop;
  return n;
end $$;
revoke all on function public.generate_recurring_bills() from public, anon, authenticated;

-- 2 + 3: GL/association match on recurring JE lines; accept daily cadence.
create or replace function public.save_recurring_journal_entry(
  p_id uuid, p_name text, p_memo text, p_frequency text, p_interval integer, p_next_date date,
  p_lines jsonb, p_active boolean)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
  v_id uuid := p_id;
  v_debits numeric; v_credits numeric; v_count int;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Name the recurring entry' using errcode = '22023'; end if;
  if p_frequency not in ('daily', 'weekly', 'monthly', 'quarterly', 'annually') then raise exception 'Choose a frequency' using errcode = '22023'; end if;
  if p_next_date is null then raise exception 'Choose the first posting date' using errcode = '22023'; end if;
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'Add journal lines' using errcode = '22023'; end if;

  select count(*), coalesce(sum(coalesce((l->>'debit')::numeric, 0)), 0), coalesce(sum(coalesce((l->>'credit')::numeric, 0)), 0)
    into v_count, v_debits, v_credits from jsonb_array_elements(p_lines) l;
  if v_count < 2 then raise exception 'A journal entry needs at least two lines' using errcode = '22023'; end if;
  if v_debits <= 0 or v_debits <> v_credits then
    raise exception 'Debits (%) must equal credits (%)', v_debits, v_credits using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_lines) l
              where (coalesce((l->>'debit')::numeric, 0) < 0 or coalesce((l->>'credit')::numeric, 0) < 0)
                 or (coalesce((l->>'debit')::numeric, 0) > 0 and coalesce((l->>'credit')::numeric, 0) > 0)
                 or (nullif(l->>'association_id', '') is not null and not public.can_access_association((l->>'association_id')::uuid))
                 or not exists (select 1 from public.gl_accounts g
                                 where g.id = (l->>'gl_account_id')::uuid and g.portfolio_id = v_pid and g.active
                                   and (g.association_id is null or g.association_id = nullif(l->>'association_id', '')::uuid))) then
    raise exception 'Each line needs one of debit or credit and an active GL account that belongs to the line''s association' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.recurring_journal_entries (portfolio_id, name, memo, frequency, interval_count, next_post_date,
                                                  auto_generate, template_lines, created_by)
    values (v_pid, btrim(p_name), nullif(btrim(coalesce(p_memo, '')), ''), p_frequency::public.recurring_frequency,
            greatest(coalesce(p_interval, 1), 1), p_next_date, coalesce(p_active, true), p_lines, auth.uid())
    returning id into v_id;
  else
    update public.recurring_journal_entries set name = btrim(p_name), memo = nullif(btrim(coalesce(p_memo, '')), ''),
      frequency = p_frequency::public.recurring_frequency, interval_count = greatest(coalesce(p_interval, 1), 1),
      next_post_date = p_next_date, auto_generate = coalesce(p_active, true), template_lines = p_lines,
      last_error = null, updated_at = now()
     where id = v_id and portfolio_id = v_pid and archived_at is null;
    if not found then raise exception 'Recurring entry not found' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

-- save_recurring_bill: accept daily (existing templates may use it).
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.save_recurring_bill(uuid, uuid, uuid, uuid, uuid, text, text, numeric, text, integer, date, date, integer, boolean)'::regprocedure) into v_def;
  v_def := replace(v_def, 'if p_frequency not in (''weekly'', ''monthly'', ''quarterly'', ''annually'')',
                          'if p_frequency not in (''daily'', ''weekly'', ''monthly'', ''quarterly'', ''annually'')');
  execute v_def;
end $$;

-- 4b. Same AP lookup inside the check run.
do $$
declare v_def text; v_old text; v_new text;
begin
  select pg_get_functiondef('public.record_check_run_legacy(uuid, uuid[], integer, date)'::regprocedure) into v_def;
  v_old := 'and active and account_type = ''liability''::public.gl_account_type';
  v_new := 'and active and (account_type = ''accounts_payable''::public.gl_account_type or account_type = ''liability''::public.gl_account_type)';
  if position(v_old in v_def) = 0 then raise exception 'record_check_run_legacy AP lookup not found'; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := 'order by (association_id = bill_row.association_id) desc, id limit 1;';
  v_new := 'order by (association_id = bill_row.association_id) desc nulls last, (number::text = ''2000'') desc, (account_type = ''accounts_payable''::public.gl_account_type) desc, id limit 1;';
  if position(v_old in v_def) = 0 then raise exception 'record_check_run_legacy AP order not found'; end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end $$;
