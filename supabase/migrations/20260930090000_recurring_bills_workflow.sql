-- Recurring bills (AppFolio "New Recurring Bill"): templates existed with a
-- daily generator (pg_cron generate-recurring-bills-daily) but no UI, and the
-- generator had problems:
--   * "auto-pay" templates created bills already marked PAID with no check and
--     no ledger entry (a phantom payment);
--   * a template with no memo produced a bill with a NULL memo;
--   * board approval rules for the association were ignored;
--   * one bad template (e.g. amount 0, archived vendor) aborted the whole run;
--   * nothing stopped the same period being billed twice.
-- Now each generated bill is linked to its template (unique per bill date),
-- dated on the scheduled date, catches up missed periods (max 12 per run),
-- follows the association's board-approval rule (needs approval → draft with
-- approval_required, otherwise approved and ready for the check run), and a
-- failing template is skipped and reported instead of blocking the rest.
-- Templates are written through save_recurring_bill(), which validates that
-- vendor / association / GL / bank belong to the caller's company.

alter table public.payable_bills
  add column if not exists recurring_bill_id uuid references public.recurring_bills(id) on delete set null;
create unique index if not exists payable_bills_recurring_period_uidx
  on public.payable_bills (recurring_bill_id, bill_date) where recurring_bill_id is not null;

alter table public.recurring_bills
  add column if not exists due_days integer not null default 0 check (due_days between 0 and 120),
  add column if not exists last_error text;

create or replace function public.recurring_next_date(p_date date, p_frequency text, p_interval integer)
returns date language sql immutable set search_path = pg_catalog as $$
  select (case p_frequency
    when 'daily' then p_date + make_interval(days => p_interval)
    when 'weekly' then p_date + make_interval(weeks => p_interval)
    when 'monthly' then p_date + make_interval(months => p_interval)
    when 'quarterly' then p_date + make_interval(months => 3 * p_interval)
    when 'annually' then p_date + make_interval(years => p_interval)
  end)::date;
$$;

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
        on conflict (recurring_bill_id, bill_date) where recurring_bill_id is not null do nothing;
        if found then n := n + 1; end if;
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

create or replace function public.save_recurring_bill(
  p_id uuid, p_vendor_id uuid, p_association_id uuid, p_gl_account_id uuid, p_bank_account_id uuid,
  p_name text, p_memo text, p_amount numeric, p_frequency text, p_interval integer,
  p_start_date date, p_end_date date, p_due_days integer, p_active boolean)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
  v_id uuid := p_id;
  v_existing record;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Name the recurring bill' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero' using errcode = '22023'; end if;
  if p_frequency not in ('weekly', 'monthly', 'quarterly', 'annually') then raise exception 'Choose a frequency' using errcode = '22023'; end if;
  if p_start_date is null then raise exception 'Choose a start date' using errcode = '22023'; end if;
  if p_end_date is not null and p_end_date < p_start_date then raise exception 'End date is before the start date' using errcode = '22023'; end if;
  if not exists (select 1 from public.vendors v where v.id = p_vendor_id and v.portfolio_id = v_pid and v.archived_at is null) then
    raise exception 'Vendor not found' using errcode = 'P0002';
  end if;
  if p_association_id is null or not public.can_access_association(p_association_id) then
    raise exception 'Choose an association' using errcode = '22023';
  end if;
  if p_gl_account_id is null or not exists (select 1 from public.gl_accounts g where g.id = p_gl_account_id and g.portfolio_id = v_pid and g.active
             and (g.association_id is null or g.association_id = p_association_id)) then
    raise exception 'Choose an expense GL account for this association' using errcode = '22023';
  end if;
  if p_bank_account_id is not null and not exists (select 1 from public.bank_accounts b where b.id = p_bank_account_id and b.portfolio_id = v_pid
             and b.archived_at is null and (b.association_id is null or b.association_id = p_association_id)) then
    raise exception 'Bank account does not belong to this association' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.recurring_bills (portfolio_id, vendor_id, association_id, gl_account_id, bank_account_id,
      name, memo, amount, frequency, interval_count, start_date, end_date, next_post_date, due_days,
      auto_generate, is_auto_pay, created_by)
    values (v_pid, p_vendor_id, p_association_id, p_gl_account_id, p_bank_account_id,
      btrim(p_name), nullif(btrim(coalesce(p_memo, '')), ''), p_amount, p_frequency::public.recurring_frequency,
      greatest(coalesce(p_interval, 1), 1), p_start_date, p_end_date, p_start_date, coalesce(p_due_days, 0),
      coalesce(p_active, true), false, auth.uid())
    returning id into v_id;
  else
    select * into v_existing from public.recurring_bills where id = v_id and portfolio_id = v_pid and archived_at is null for update;
    if not found then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;
    update public.recurring_bills set
      vendor_id = p_vendor_id, association_id = p_association_id, gl_account_id = p_gl_account_id,
      bank_account_id = p_bank_account_id, name = btrim(p_name), memo = nullif(btrim(coalesce(p_memo, '')), ''),
      amount = p_amount, frequency = p_frequency::public.recurring_frequency,
      interval_count = greatest(coalesce(p_interval, 1), 1), start_date = p_start_date, end_date = p_end_date,
      -- Moving the start date forward reschedules; otherwise keep the running schedule.
      next_post_date = case when p_start_date > coalesce(v_existing.next_post_date, p_start_date) then p_start_date
                            else coalesce(v_existing.next_post_date, p_start_date) end,
      due_days = coalesce(p_due_days, 0), auto_generate = coalesce(p_active, true), last_error = null, updated_at = now()
    where id = v_id;
  end if;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'recurring_bill', v_id, case when p_id is null then 'created' else 'updated' end, auth.uid(),
          (select email from auth.users where id = auth.uid()),
          jsonb_build_object('name', btrim(p_name), 'amount', p_amount, 'frequency', p_frequency, 'active', coalesce(p_active, true)));
  return v_id;
end $$;

create or replace function public.archive_recurring_bill(p_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_pid uuid;
begin
  select portfolio_id into v_pid from public.recurring_bills where id = p_id and archived_at is null for update;
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;
  update public.recurring_bills set archived_at = now(), auto_generate = false, updated_at = now() where id = p_id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'recurring_bill', p_id, 'archived', auth.uid(), (select email from auth.users where id = auth.uid()), '{}'::jsonb);
end $$;

-- Recurring journal entries: same isolation so one bad template cannot block the rest.
alter table public.recurring_journal_entries add column if not exists last_error text;
create or replace function public.generate_recurring_journal_entries()
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare t record; v_entry uuid; line jsonb; n integer := 0;
begin
  for t in
    select * from public.recurring_journal_entries
     where auto_generate and archived_at is null and next_post_date is not null and next_post_date <= current_date
  loop
    begin
      insert into public.journal_entries (portfolio_id, entry_date, memo, source_type, source_id, created_by, posted)
      values (t.portfolio_id, t.next_post_date, coalesce(nullif(btrim(t.memo), ''), t.name) || ' (recurring)',
              'recurring_je', t.id, t.created_by, false)
      returning id into v_entry;
      for line in select * from jsonb_array_elements(coalesce(t.template_lines, '[]'::jsonb)) loop
        insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo)
        values (v_entry, (line->>'gl_account_id')::uuid, nullif(line->>'association_id', '')::uuid,
                coalesce((line->>'debit')::numeric, 0), coalesce((line->>'credit')::numeric, 0), line->>'memo');
      end loop;
      update public.journal_entries set posted = true where id = v_entry;
      update public.recurring_journal_entries
         set next_post_date = public.recurring_next_date(t.next_post_date, t.frequency::text, t.interval_count),
             last_generated_at = now(), last_error = null, updated_at = now()
       where id = t.id;
      n := n + 1;
    exception when others then
      update public.recurring_journal_entries set last_error = left(sqlerrm, 500), updated_at = now() where id = t.id;
    end;
  end loop;
  return n;
end $$;

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
  if p_frequency not in ('weekly', 'monthly', 'quarterly', 'annually') then raise exception 'Choose a frequency' using errcode = '22023'; end if;
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
                 or not exists (select 1 from public.gl_accounts g where g.id = (l->>'gl_account_id')::uuid and g.portfolio_id = v_pid and g.active)
                 or (nullif(l->>'association_id', '') is not null and not public.can_access_association((l->>'association_id')::uuid))) then
    raise exception 'Each line needs an active GL account, one of debit or credit, and an association you manage' using errcode = '22023';
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

do $$
declare f text;
begin
  foreach f in array array[
    'public.save_recurring_bill(uuid, uuid, uuid, uuid, uuid, text, text, numeric, text, integer, date, date, integer, boolean)',
    'public.archive_recurring_bill(uuid)',
    'public.save_recurring_journal_entry(uuid, text, text, text, integer, date, jsonb, boolean)'] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  foreach f in array array['public.generate_recurring_bills()', 'public.generate_recurring_journal_entries()'] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
