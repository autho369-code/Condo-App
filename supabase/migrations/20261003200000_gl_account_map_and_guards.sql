-- GL Accounts (AppFolio parity + audit fixes).
-- 1. GL account map (AppFolio "GL Account Map"): the company chooses the
--    default accounts system postings use: A/R, A/P, late fee income,
--    default income, assessment income and undeposited funds. Postings read
--    the map first and fall back to the old number/name rules.
-- 2. Every A/P selector uses one order (map → association → 2000 → named
--    "Accounts Payable" → A/P type → number → id), and the check run relieves
--    the same A/P account the bill accrual credited.
-- 3. Guards on gl_accounts (every write path, not only the edit form):
--    - deactivating a balance-sheet account that has a balance, is a bank account's GL, or
--      is a mapped default is refused (A/R or A/P would otherwise move to a
--      different account mid-stream);
--    - an account with posted lines keeps its type and association;
--    - the association must belong to the account's company;
--    - a sub-account's parent has the same type and company, a compatible
--      association, and no cycle.
-- gl_account_in_use (20261003030000) was never applied; it is created here too.

create or replace function public.gl_account_in_use(p_gl_account_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'pg_catalog', 'public' as $$
declare
  r record;
  v_found boolean;
  v_portfolio uuid;
begin
  select portfolio_id into v_portfolio from public.gl_accounts where id = p_gl_account_id;
  if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
    raise exception 'GL account not found';
  end if;
  for r in
    select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = 'public.gl_accounts'::regclass
       and array_length(c.conkey, 1) = 1
       and c.conrelid <> 'public.gl_accounts'::regclass
  loop
    execute format('select exists (select 1 from %s where %I = $1)', r.tbl, r.col)
      into v_found using p_gl_account_id;
    if v_found then
      return true;
    end if;
  end loop;
  return exists (select 1 from public.gl_accounts where sub_account_of_id = p_gl_account_id);
end $$;
revoke all on function public.gl_account_in_use(uuid) from public, anon;
grant execute on function public.gl_account_in_use(uuid) to authenticated;

-- ── 1. GL account map ────────────────────────────────────────
create table if not exists public.gl_account_map (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id),
  association_id uuid references public.associations(id),
  map_key text not null check (map_key in ('accounts_receivable', 'accounts_payable', 'late_fee_income', 'default_income',
                                           'assessment_income', 'undeposited_funds')),
  gl_account_id uuid not null references public.gl_accounts(id),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create unique index if not exists gl_account_map_scope_key on public.gl_account_map
  (portfolio_id, coalesce(association_id, '00000000-0000-0000-0000-000000000000'::uuid), map_key);
alter table public.gl_account_map enable row level security;
revoke all on public.gl_account_map from anon, authenticated;
grant select on public.gl_account_map to authenticated;
create policy gl_account_map_staff_read on public.gl_account_map for select to authenticated
  using (public.is_any_staff() and public.can_access_portfolio(portfolio_id));

-- The mapped account for a key: the association's own mapping, else the
-- company's. Only an active account counts.
create or replace function public.app_gl_map(p_portfolio uuid, p_association uuid, p_key text)
returns uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select m.gl_account_id from public.gl_account_map m join public.gl_accounts g on g.id = m.gl_account_id and g.active
   where m.portfolio_id = p_portfolio and m.map_key = p_key
     and (m.association_id is null or m.association_id = p_association)
   order by (m.association_id is null)
   limit 1;
$$;
revoke all on function public.app_gl_map(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.set_gl_account_map(p_key text, p_gl_account_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
  v_type text;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
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
  insert into public.gl_account_map (portfolio_id, association_id, map_key, gl_account_id, updated_by)
  values (v_pid, null, p_key, p_gl_account_id, auth.uid())
  on conflict (portfolio_id, coalesce(association_id, '00000000-0000-0000-0000-000000000000'::uuid), map_key)
  do update set gl_account_id = excluded.gl_account_id, updated_by = excluded.updated_by, updated_at = now();
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (v_pid, 'gl_account_map', p_gl_account_id, 'mapped', auth.uid(), jsonb_build_object('key', p_key));
end $$;
revoke all on function public.set_gl_account_map(text, uuid) from public, anon;
grant execute on function public.set_gl_account_map(text, uuid) to authenticated;

-- ── Postings read the map first ───────────────────────────────
do $$
declare def text;
begin
  def := pg_get_functiondef('public.charge_gl_accounts(public.charges)'::regprocedure);
  if position('ar := public.gl_pick(v_portfolio, v_assoc, array[''accounts_receivable''], null, ''%allowance%'');' in def) = 0
     or position('public.gl_pick(v_portfolio, v_assoc, array[''income''], ''%late fee%'')' in def) = 0
     or position('    public.gl_pick(v_portfolio, v_assoc, array[''income'']));' in def) = 0 then
    raise exception 'charge_gl_accounts drifted';
  end if;
  def := replace(def, 'ar := public.gl_pick(v_portfolio, v_assoc, array[''accounts_receivable''], null, ''%allowance%'');',
    'ar := coalesce(public.app_gl_map(v_portfolio, v_assoc, ''accounts_receivable''), public.gl_pick(v_portfolio, v_assoc, array[''accounts_receivable''], null, ''%allowance%''));');
  def := replace(def, 'public.gl_pick(v_portfolio, v_assoc, array[''income''], ''%late fee%'')',
    'coalesce(public.app_gl_map(v_portfolio, v_assoc, ''late_fee_income''), public.gl_pick(v_portfolio, v_assoc, array[''income''], ''%late fee%''))');
  def := replace(def, '    public.gl_pick(v_portfolio, v_assoc, array[''income'']));',
    '    public.app_gl_map(v_portfolio, v_assoc, ''default_income''),' || chr(10) || '    public.gl_pick(v_portfolio, v_assoc, array[''income'']));');
  execute def;

  def := pg_get_functiondef('public.payment_gl_accounts(public.payments)'::regprocedure);
  if position('ar := public.gl_pick(v_portfolio, v_assoc, array[''accounts_receivable''], null, ''%allowance%'');' in def) = 0
     or position('public.gl_pick(v_portfolio, v_assoc, array[''cash''], ''%undeposited%''),' in def) = 0 then
    raise exception 'payment_gl_accounts drifted';
  end if;
  def := replace(def, 'ar := public.gl_pick(v_portfolio, v_assoc, array[''accounts_receivable''], null, ''%allowance%'');',
    'ar := coalesce(public.app_gl_map(v_portfolio, v_assoc, ''accounts_receivable''), public.gl_pick(v_portfolio, v_assoc, array[''accounts_receivable''], null, ''%allowance%''));');
  def := replace(def, 'public.gl_pick(v_portfolio, v_assoc, array[''cash''], ''%undeposited%''),',
    'public.app_gl_map(v_portfolio, v_assoc, ''undeposited_funds''),' || chr(10) || '    public.gl_pick(v_portfolio, v_assoc, array[''cash''], ''%undeposited%''),');
  execute def;

  def := pg_get_functiondef('public.post_assessment_charges()'::regprocedure);
  if position('  -- Fan out charges for every active unit' in def) = 0 then raise exception 'post_assessment_charges drifted'; end if;
  def := replace(def, '  -- Fan out charges for every active unit',
    '  charge_gl_id := coalesce(public.app_gl_map((select a.portfolio_id from public.associations a where a.id = new.association_id),' || chr(10) ||
    '                                            new.association_id, ''assessment_income''), charge_gl_id,' || chr(10) ||
    '    (select g.id from public.gl_accounts g join public.associations a on a.id = new.association_id and g.portfolio_id = a.portfolio_id' || chr(10) ||
    '      where g.association_id is null and g.account_type = ''income'' and g.number between 4000 and 4999 and g.active order by g.number, g.id limit 1));' || chr(10) || chr(10) ||
    '  -- Fan out charges for every active unit');
  execute def;
end $$;

-- ── 2. One A/P rule ──────────────────────────────────────────
create or replace function public.app_ap_account(p_portfolio_id uuid, p_association_id uuid)
returns uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(
    public.app_gl_map(p_portfolio_id, p_association_id, 'accounts_payable'),
    (select id from public.gl_accounts
      where portfolio_id = p_portfolio_id and active
        and (account_type = 'accounts_payable'::public.gl_account_type
             or (account_type = 'liability'::public.gl_account_type and (number::text = '2000' or lower(name) = 'accounts payable')))
        and (association_id is null or association_id = p_association_id)
      order by (association_id = p_association_id) desc nulls last, (number::text = '2000') desc,
               (lower(name) = 'accounts payable') desc, (account_type = 'accounts_payable'::public.gl_account_type) desc, number, id
      limit 1));
$$;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.ensure_payable_bill_accrual(uuid)'::regprocedure);
  if def !~ 'select id into ap_account_id from public\.gl_accounts' then raise exception 'ensure_payable_bill_accrual drifted'; end if;
  def := regexp_replace(def, 'select id into ap_account_id from public\.gl_accounts.*?limit 1;',
    'ap_account_id := public.app_ap_account(bill_row.portfolio_id, bill_row.association_id);');
  execute def;

  -- The check run relieves the A/P account the bill's accrual credited.
  def := pg_get_functiondef('public.record_check_run_legacy(uuid, uuid[], integer, date)'::regprocedure);
  if def !~ 'select id into ap_account_id from public\.gl_accounts' then raise exception 'record_check_run_legacy drifted'; end if;
  def := regexp_replace(def, 'select id into ap_account_id from public\.gl_accounts.*?limit 1;',
    'select jl.gl_account_id into ap_account_id from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id' || chr(10) ||
    '     where je.source_type = ''payable_bill'' and je.source_id = bill_id and je.posted and jl.credit_amount > 0' || chr(10) ||
    '     order by je.created_at desc limit 1;' || chr(10) ||
    '    ap_account_id := coalesce(ap_account_id, public.app_ap_account(bill_row.portfolio_id, bill_row.association_id));');
  execute def;
end $$;

-- ── 3. Guards on gl_accounts ─────────────────────────────────
create or replace function public.guard_gl_account_change()
returns trigger language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare
  v_parent public.gl_accounts;
  v_cursor uuid;
  v_hops int := 0;
  v_balance numeric;
begin
  -- Shape checks run when the shape changes, so old rows stay editable.
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
  end if;

  if tg_op = 'UPDATE' then
    if (new.account_type is distinct from old.account_type or new.association_id is distinct from old.association_id)
       and exists (select 1 from public.journal_lines where gl_account_id = old.id) then
      raise exception 'This account has ledger entries; its type and association cannot change. Create a new account instead.' using errcode = '22023';
    end if;
    -- Balance-sheet accounts carry their balance forward; income and expense
    -- accounts only report activity by period, so those may be retired.
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
end $$;
revoke all on function public.guard_gl_account_change() from public, anon, authenticated;

create or replace trigger trg_guard_gl_account_change before insert or update on public.gl_accounts
  for each row execute function public.guard_gl_account_change();
