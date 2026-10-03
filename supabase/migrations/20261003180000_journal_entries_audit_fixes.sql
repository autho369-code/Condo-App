-- Journal Entries audit fixes (AppFolio parity).
-- 1. One rule for journal lines (manual and recurring): every line has an
--    association, an active GL account of the company that is company-wide or
--    that association's, and exactly one of debit/credit; amounts are rounded
--    to cents before the balance check (unrounded checks let 33.335 + 33.335 +
--    33.33 "balance" and then fail when stored).
-- 2. Manual entries post through one RPC (no orphan drafts).
-- 3. A posted manual, recurring, uploaded or other-deposit entry can be
--    reversed with a dated reversing entry. Entries from receipts, bills,
--    checks and other subledgers are voided from their own records.
-- 4. Recurring entries: end date, stop, edit, and "post through a date"
--    (AppFolio's manually post recurring journal entries), sharing one routine
--    with the nightly run; GL accounts are re-checked when posting.

-- ── 1. Line validation ───────────────────────────────────────
create or replace function public.app_normalize_je_lines(p_pid uuid, p_lines jsonb, p_check_scope boolean)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  l jsonb;
  out jsonb := '[]'::jsonb;
  v_gl uuid; v_assoc uuid; v_d numeric; v_c numeric;
  v_td numeric := 0; v_tc numeric := 0; n int := 0;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'Add journal lines' using errcode = '22023'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    n := n + 1;
    begin
      v_gl := nullif(l->>'gl_account_id', '')::uuid;
      v_assoc := nullif(l->>'association_id', '')::uuid;
      v_d := round(coalesce(nullif(l->>'debit', '')::numeric, 0), 2);
      v_c := round(coalesce(nullif(l->>'credit', '')::numeric, 0), 2);
    exception when others then
      raise exception 'Line %: amounts must be numbers', n using errcode = '22023';
    end;
    if v_d < 0 or v_c < 0 or (v_d > 0) = (v_c > 0) then
      raise exception 'Line %: enter either a debit or a credit, not both', n using errcode = '22023';
    end if;
    if v_assoc is null or not exists (select 1 from public.associations a where a.id = v_assoc and a.portfolio_id = p_pid)
       or (p_check_scope and not public.can_manage_association(v_assoc)) then
      raise exception 'Line %: choose an association you manage', n using errcode = '22023';
    end if;
    if v_gl is null or not exists (select 1 from public.gl_accounts g where g.id = v_gl and g.portfolio_id = p_pid and g.active
                                     and (g.association_id is null or g.association_id = v_assoc)) then
      raise exception 'Line %: choose an active GL account of that association', n using errcode = '22023';
    end if;
    v_td := v_td + v_d; v_tc := v_tc + v_c;
    out := out || jsonb_build_object('gl_account_id', v_gl, 'association_id', v_assoc, 'debit', v_d, 'credit', v_c,
                                     'memo', nullif(btrim(coalesce(l->>'memo', '')), ''));
  end loop;
  if n < 2 then raise exception 'A journal entry needs at least two lines' using errcode = '22023'; end if;
  if v_td <= 0 or v_td <> v_tc then
    raise exception 'Debits (%) must equal credits (%)', v_td, v_tc using errcode = '22023';
  end if;
  return out;
end $$;
revoke all on function public.app_normalize_je_lines(uuid, jsonb, boolean) from public, anon, authenticated;

-- ── 2. Manual entries ────────────────────────────────────────
create or replace function public.post_manual_journal_entry(
  p_entry_date date, p_description text, p_reference text, p_memo text, p_lines jsonb)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
  v_lines jsonb;
  v_entry uuid;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if p_entry_date is null then raise exception 'Entry date is required' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_description, ''))) = 0 then raise exception 'Description is required' using errcode = '22023'; end if;
  v_lines := public.app_normalize_je_lines(v_pid, p_lines, true);

  insert into public.journal_entries (portfolio_id, entry_date, description, reference_number, memo, created_by, posted)
  values (v_pid, p_entry_date, left(btrim(p_description), 500), nullif(btrim(coalesce(p_reference, '')), ''),
          nullif(btrim(coalesce(p_memo, '')), ''), auth.uid(), false)
  returning id into v_entry;
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
  select v_entry, (l->>'gl_account_id')::uuid, (l->>'association_id')::uuid, (l->>'debit')::numeric, (l->>'credit')::numeric,
         l->>'memo', (ord - 1)::int
    from jsonb_array_elements(v_lines) with ordinality as t(l, ord);
  update public.journal_entries set posted = true, posted_at = now() where id = v_entry;
  return v_entry;
end $$;

-- ── 3. Reverse a posted entry ─────────────────────────────────
alter table public.journal_entries add column if not exists reversed_by_entry_id uuid references public.journal_entries(id);

create or replace function public.reverse_journal_entry(p_id uuid, p_reversal_date date, p_reason text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  e public.journal_entries;
  v_rev uuid;
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
    raise exception 'This entry belongs to a % — void or reverse it from that record', replace(e.source_type, '_', ' ') using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason for the reversal' using errcode = '22023'; end if;

  insert into public.journal_entries (portfolio_id, entry_date, description, memo, reference_number, source_type, source_id, created_by, posted)
  values (e.portfolio_id, coalesce(p_reversal_date, current_date), left('Reversal: ' || coalesce(e.description, e.memo, 'journal entry'), 500),
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
end $$;

-- ── 4. Recurring entries ─────────────────────────────────────
alter table public.recurring_journal_entries add column if not exists end_date date;

create or replace function public.save_recurring_journal_entry(
  p_id uuid, p_name text, p_memo text, p_frequency text, p_interval integer, p_next_date date, p_lines jsonb,
  p_active boolean, p_end_date date)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
  v_id uuid := p_id;
  v_lines jsonb;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Name the recurring entry' using errcode = '22023'; end if;
  if p_frequency not in ('daily', 'weekly', 'monthly', 'quarterly', 'annually') then raise exception 'Choose a frequency' using errcode = '22023'; end if;
  if p_next_date is null then raise exception 'Choose the next posting date' using errcode = '22023'; end if;
  if p_end_date is not null and p_end_date < p_next_date then raise exception 'The end date is before the next posting date' using errcode = '22023'; end if;
  v_lines := public.app_normalize_je_lines(v_pid, p_lines, true);

  if v_id is null then
    insert into public.recurring_journal_entries (portfolio_id, name, memo, frequency, interval_count, next_post_date, end_date,
                                                  auto_generate, template_lines, created_by)
    values (v_pid, btrim(p_name), nullif(btrim(coalesce(p_memo, '')), ''), p_frequency::public.recurring_frequency,
            greatest(coalesce(p_interval, 1), 1), p_next_date, p_end_date, coalesce(p_active, true), v_lines, auth.uid())
    returning id into v_id;
  else
    update public.recurring_journal_entries set name = btrim(p_name), memo = nullif(btrim(coalesce(p_memo, '')), ''),
      frequency = p_frequency::public.recurring_frequency, interval_count = greatest(coalesce(p_interval, 1), 1),
      next_post_date = p_next_date, end_date = p_end_date, auto_generate = coalesce(p_active, true), template_lines = v_lines,
      last_error = null, updated_at = now()
     where id = v_id and portfolio_id = v_pid and archived_at is null;
    if not found then raise exception 'Recurring entry not found' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;
-- The old 8-argument version skipped the shared line rules.
revoke all on function public.save_recurring_journal_entry(uuid, text, text, text, integer, date, jsonb, boolean) from public, anon, authenticated;

create or replace function public.archive_recurring_journal_entry(p_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_pid uuid := public.current_portfolio_id();
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  update public.recurring_journal_entries set archived_at = now(), auto_generate = false, updated_at = now()
   where id = p_id and portfolio_id = v_pid and archived_at is null;
  if not found then raise exception 'Recurring entry not found' using errcode = 'P0002'; end if;
end $$;

create or replace function public.generate_recurring_journal_entries_through(p_portfolio_id uuid, p_through date, p_scoped boolean)
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
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
      -- Accounts and associations are re-checked at posting time.
      v_lines := public.app_normalize_je_lines(t.portfolio_id, t.template_lines, p_scoped);
      v_date := t.next_post_date;
      v_guard := 0;
      while v_date <= p_through and (t.end_date is null or v_date <= t.end_date) and v_guard < 12 loop
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
end $$;
revoke all on function public.generate_recurring_journal_entries_through(uuid, date, boolean) from public, anon, authenticated;

create or replace function public.generate_recurring_journal_entries()
returns integer language sql security definer set search_path = pg_catalog, public as $$
  select public.generate_recurring_journal_entries_through(null, current_date, false);
$$;
revoke all on function public.generate_recurring_journal_entries() from public, anon, authenticated;

create or replace function public.post_recurring_journal_entries(p_through date)
returns integer language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_pid uuid := public.current_portfolio_id(); n integer;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if p_through is null then raise exception 'Choose a post-through date' using errcode = '22023'; end if;
  if p_through > current_date + 366 then raise exception 'Post-through date can be at most a year ahead' using errcode = '22023'; end if;
  n := public.generate_recurring_journal_entries_through(v_pid, p_through, true);
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (v_pid, 'recurring_journal_entry', null, 'posted', auth.uid(), jsonb_build_object('through', p_through, 'entries', n));
  return n;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.post_manual_journal_entry(date, text, text, text, jsonb)',
    'public.reverse_journal_entry(uuid, date, text)',
    'public.save_recurring_journal_entry(uuid, text, text, text, integer, date, jsonb, boolean, date)',
    'public.archive_recurring_journal_entry(uuid)',
    'public.post_recurring_journal_entries(date)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
