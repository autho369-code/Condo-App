-- Year-end close package.
--
-- For an association and fiscal year: a readiness checklist, then an
-- immutable snapshot of the year's statements (trial balance, balance sheet,
-- income statement vs budget, fund summary, receivables, bank balances)
-- fingerprinted with SHA-256. Finalizing requires every required check to
-- pass; a finalized package can never be edited — only superseded, with a
-- reason, by a portfolio administrator.

-- ── Fiscal year window (labelled by the calendar year it ends in) ──────────
create or replace function public.association_fiscal_window(p_association_id uuid, p_fiscal_year integer)
returns table(period_start date, period_end date)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  with m as (
    select coalesce(nullif(a.fiscal_year_start, 0), 1)::integer as start_month
      from public.associations a where a.id = p_association_id
  )
  select case when m.start_month = 1 then make_date(p_fiscal_year, 1, 1)
              else make_date(p_fiscal_year - 1, m.start_month, 1) end,
         (case when m.start_month = 1 then make_date(p_fiscal_year + 1, 1, 1)
               else make_date(p_fiscal_year, m.start_month, 1) end - 1)
    from m;
$$;

-- Section / normal balance, mirroring lib/reports/financial.ts.
create or replace function public.gl_section(p_account_type text)
returns text language sql immutable set search_path = pg_catalog, public as $$
  select case
    when p_account_type in ('asset', 'cash', 'accounts_receivable', 'fixed_asset') then 'asset'
    when p_account_type in ('liability', 'accounts_payable') then 'liability'
    when p_account_type = 'equity' then 'equity'
    when p_account_type in ('income', 'other_income') then 'income'
    when p_account_type in ('expense', 'cost_of_goods_sold', 'other_expense', 'non_operating') then 'expense'
  end;
$$;

create or replace function public.gl_normal_amount(p_account_type text, p_debit numeric, p_credit numeric)
returns numeric language sql immutable set search_path = pg_catalog, public as $$
  select case when public.gl_section(p_account_type) in ('asset', 'expense')
              then coalesce(p_debit, 0) - coalesce(p_credit, 0)
              else coalesce(p_credit, 0) - coalesce(p_debit, 0) end;
$$;

-- ── Package table ──────────────────────────────────────────────────────────
create table if not exists public.year_end_packages (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  fiscal_year integer not null check (fiscal_year between 2000 and 2100),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'finalized', 'superseded')),
  checklist jsonb not null default '[]'::jsonb,
  snapshot jsonb not null,
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  notes text,
  generated_by uuid,
  generated_at timestamptz not null default now(),
  finalized_by uuid,
  finalized_at timestamptz,
  superseded_by uuid,
  superseded_at timestamptz,
  supersede_reason text,
  signature_request_id uuid references public.signature_requests(id) on delete set null
);
create unique index if not exists year_end_packages_one_active
  on public.year_end_packages (association_id, fiscal_year)
  where status in ('draft', 'finalized');
create index if not exists idx_year_end_packages_portfolio on public.year_end_packages (portfolio_id, fiscal_year desc);

alter table public.year_end_packages enable row level security;
drop policy if exists year_end_packages_staff_read on public.year_end_packages;
create policy year_end_packages_staff_read on public.year_end_packages for select to authenticated
  using (public.can_access_portfolio(portfolio_id) and public.can_view_association_row(association_id)
         and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()));
drop policy if exists year_end_packages_board_read on public.year_end_packages;
create policy year_end_packages_board_read on public.year_end_packages for select to authenticated
  using (status = 'finalized' and public.is_board_user() and association_id in (select public.current_board_association_ids()));
revoke all on public.year_end_packages from anon, authenticated;
grant select on public.year_end_packages to authenticated;

-- A finalized snapshot is permanent.
create or replace function public.guard_year_end_package()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if old.status in ('finalized', 'superseded') then
    if new.snapshot is distinct from old.snapshot or new.snapshot_sha256 is distinct from old.snapshot_sha256
       or new.checklist is distinct from old.checklist or new.period_start is distinct from old.period_start
       or new.period_end is distinct from old.period_end or new.finalized_at is distinct from old.finalized_at then
      raise exception 'A finalized year-end package cannot be changed';
    end if;
    if old.status = 'superseded' and new.status <> 'superseded' then
      raise exception 'A superseded package cannot be reinstated';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_year_end_package on public.year_end_packages;
create trigger trg_guard_year_end_package before update on public.year_end_packages
  for each row execute function public.guard_year_end_package();

create or replace function public.prevent_finalized_package_delete()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if old.status <> 'draft' then raise exception 'Finalized year-end packages cannot be deleted'; end if;
  return old;
end;
$$;
drop trigger if exists trg_prevent_finalized_package_delete on public.year_end_packages;
create trigger trg_prevent_finalized_package_delete before delete on public.year_end_packages
  for each row execute function public.prevent_finalized_package_delete();

-- ── Readiness checklist ────────────────────────────────────────────────────
create or replace function public.year_end_readiness(p_association_id uuid, p_fiscal_year integer)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
  v_portfolio uuid;
  w record;
  v_open_periods integer;
  v_missing_periods integer;
  v_unposted integer;
  v_unreconciled integer;
  v_debits numeric;
  v_credits numeric;
  v_clearing numeric;
  v_1099 integer;
  v_budget integer;
  items jsonb := '[]'::jsonb;
begin
  select portfolio_id into v_portfolio from public.associations where id = p_association_id;
  if v_portfolio is null then raise exception 'Association not found'; end if;
  if not (public.can_access_portfolio(v_portfolio) and public.can_view_association_row(p_association_id)
          and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  select * into w from public.association_fiscal_window(p_association_id, p_fiscal_year);

  select count(*) filter (where ap.id is null), count(*) filter (where ap.id is not null and ap.status::text <> 'closed')
    into v_missing_periods, v_open_periods
    from generate_series(w.period_start, w.period_end, interval '1 month') g(month_start)
    left join public.accounting_periods ap
      on ap.portfolio_id = v_portfolio
     and ap.fiscal_year = extract(year from g.month_start)::integer
     and ap.period_month = extract(month from g.month_start)::integer;

  select count(distinct je.id) into v_unposted
    from public.journal_entries je join public.journal_lines jl on jl.entry_id = je.id
   where jl.association_id = p_association_id and not je.posted
     and je.entry_date between w.period_start and w.period_end;

  select count(*) into v_unreconciled
    from public.bank_accounts b
   where b.association_id = p_association_id and b.archived_at is null
     and (b.last_reconciliation_date is null or b.last_reconciliation_date < w.period_end);

  select coalesce(sum(jl.debit_amount), 0), coalesce(sum(jl.credit_amount), 0) into v_debits, v_credits
    from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
   where jl.association_id = p_association_id and je.posted and je.entry_date <= w.period_end;

  select coalesce(sum(abs(t.bal)), 0) into v_clearing from (
    select sum(jl.debit_amount - jl.credit_amount) bal
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id
      join public.gl_accounts g on g.id = jl.gl_account_id
     where jl.association_id = p_association_id and je.posted and je.entry_date <= w.period_end
       and (g.name ilike '%clearing%' or g.name ilike '%suspense%')
     group by g.id) t;

  select count(*) into v_1099 from (
    select b.vendor_id from public.payable_bills b join public.vendors v on v.id = b.vendor_id
     where b.association_id = p_association_id and b.status::text = 'paid'
       and b.paid_at::date between w.period_start and w.period_end
       and coalesce(v.send_1099, false) and nullif(btrim(coalesce(v.taxpayer_id, '')), '') is null
     group by b.vendor_id having sum(b.amount) >= 600) x;

  select count(*) into v_budget from public.budget_lines where association_id = p_association_id and fiscal_year = p_fiscal_year;

  items := jsonb_build_array(
    jsonb_build_object('key', 'periods_closed', 'required', true, 'ok', v_open_periods = 0 and v_missing_periods = 0,
      'label', 'All accounting months in the fiscal year are closed',
      'detail', case when v_missing_periods > 0 then v_missing_periods || ' month(s) not initialized'
                     when v_open_periods > 0 then v_open_periods || ' month(s) still open' else 'All 12 months closed' end),
    jsonb_build_object('key', 'no_drafts', 'required', true, 'ok', v_unposted = 0,
      'label', 'No draft journal entries in the year', 'detail', v_unposted || ' draft entr' || case when v_unposted = 1 then 'y' else 'ies' end),
    jsonb_build_object('key', 'banks_reconciled', 'required', true, 'ok', v_unreconciled = 0,
      'label', 'Every bank account reconciled through year end', 'detail', v_unreconciled || ' account(s) not reconciled through ' || w.period_end),
    jsonb_build_object('key', 'trial_balance', 'required', true, 'ok', abs(v_debits - v_credits) < 0.005,
      'label', 'Trial balance is in balance', 'detail', 'Debits $' || to_char(v_debits, 'FM999,999,990.00') || ' · credits $' || to_char(v_credits, 'FM999,999,990.00')),
    jsonb_build_object('key', 'clearing_zero', 'required', false, 'ok', v_clearing < 0.005,
      'label', 'Clearing and suspense accounts are zero', 'detail', '$' || to_char(v_clearing, 'FM999,999,990.00') || ' unresolved'),
    jsonb_build_object('key', 'vendor_tins', 'required', false, 'ok', v_1099 = 0,
      'label', '1099 vendors paid $600+ have a taxpayer ID', 'detail', v_1099 || ' vendor(s) missing a TIN'),
    jsonb_build_object('key', 'budget', 'required', false, 'ok', v_budget > 0,
      'label', 'An annual budget exists for comparison', 'detail', v_budget || ' budget line(s)')
  );
  return jsonb_build_object('period_start', w.period_start, 'period_end', w.period_end, 'items', items,
    'ready', not exists (select 1 from jsonb_array_elements(items) i where (i ->> 'required')::boolean and not (i ->> 'ok')::boolean));
end;
$$;

-- ── Snapshot builder ───────────────────────────────────────────────────────
create or replace function public.build_year_end_snapshot(p_association_id uuid, p_fiscal_year integer)
returns jsonb
language plpgsql volatile security definer
set search_path = pg_catalog, public
as $$
declare
  w record;
  a record;
  v_tb jsonb; v_bs jsonb; v_is jsonb; v_funds jsonb; v_ar jsonb; v_banks jsonb;
  v_ni_year numeric; v_ni_prior numeric;
  v_assets numeric; v_liab numeric; v_equity numeric;
  v_income numeric; v_expense numeric; v_budget_income numeric; v_budget_expense numeric;
begin
  select * into w from public.association_fiscal_window(p_association_id, p_fiscal_year);
  select id, name, legal_name, address, city, state, zip, tax_id, portfolio_id into a from public.associations where id = p_association_id;

  -- Posted activity per account: to year end, before the year, within the year.
  create temp table if not exists _ye_lines (
    gl_id uuid, number integer, name text, account_type text, fund_account text,
    d_to_end numeric, c_to_end numeric, d_prior numeric, c_prior numeric, d_year numeric, c_year numeric
  ) on commit drop;
  truncate _ye_lines;
  insert into _ye_lines
    select g.id, g.number, g.name, g.account_type::text, g.fund_account::text,
           sum(case when je.entry_date <= w.period_end then jl.debit_amount else 0 end),
           sum(case when je.entry_date <= w.period_end then jl.credit_amount else 0 end),
           sum(case when je.entry_date < w.period_start then jl.debit_amount else 0 end),
           sum(case when je.entry_date < w.period_start then jl.credit_amount else 0 end),
           sum(case when je.entry_date between w.period_start and w.period_end then jl.debit_amount else 0 end),
           sum(case when je.entry_date between w.period_start and w.period_end then jl.credit_amount else 0 end)
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted
      join public.gl_accounts g on g.id = jl.gl_account_id
     where jl.association_id = p_association_id
     group by g.id;

  select coalesce(jsonb_agg(jsonb_build_object('number', number, 'name', name, 'type', account_type, 'fund', fund_account,
            'debit', round(d_year, 2), 'credit', round(c_year, 2)) order by number, name, gl_id) filter (where d_year <> 0 or c_year <> 0), '[]'::jsonb)
    into v_tb from _ye_lines;

  select coalesce(sum(public.gl_normal_amount(account_type, d_year, c_year)) filter (where public.gl_section(account_type) = 'income'), 0)
       - coalesce(sum(public.gl_normal_amount(account_type, d_year, c_year)) filter (where public.gl_section(account_type) = 'expense'), 0),
         coalesce(sum(public.gl_normal_amount(account_type, d_prior, c_prior)) filter (where public.gl_section(account_type) = 'income'), 0)
       - coalesce(sum(public.gl_normal_amount(account_type, d_prior, c_prior)) filter (where public.gl_section(account_type) = 'expense'), 0),
         coalesce(sum(public.gl_normal_amount(account_type, d_to_end, c_to_end)) filter (where public.gl_section(account_type) = 'asset'), 0),
         coalesce(sum(public.gl_normal_amount(account_type, d_to_end, c_to_end)) filter (where public.gl_section(account_type) = 'liability'), 0),
         coalesce(sum(public.gl_normal_amount(account_type, d_to_end, c_to_end)) filter (where public.gl_section(account_type) = 'equity'), 0)
    into v_ni_year, v_ni_prior, v_assets, v_liab, v_equity
    from _ye_lines;

  select jsonb_build_object(
    'assets', coalesce((select jsonb_agg(jsonb_build_object('number', number, 'name', name, 'fund', fund_account, 'balance', round(public.gl_normal_amount(account_type, d_to_end, c_to_end), 2)) order by number, name, gl_id)
                          from _ye_lines where public.gl_section(account_type) = 'asset' and public.gl_normal_amount(account_type, d_to_end, c_to_end) <> 0), '[]'::jsonb),
    'liabilities', coalesce((select jsonb_agg(jsonb_build_object('number', number, 'name', name, 'fund', fund_account, 'balance', round(public.gl_normal_amount(account_type, d_to_end, c_to_end), 2)) order by number, name, gl_id)
                          from _ye_lines where public.gl_section(account_type) = 'liability' and public.gl_normal_amount(account_type, d_to_end, c_to_end) <> 0), '[]'::jsonb),
    'equity', coalesce((select jsonb_agg(jsonb_build_object('number', number, 'name', name, 'fund', fund_account, 'balance', round(public.gl_normal_amount(account_type, d_to_end, c_to_end), 2)) order by number, name, gl_id)
                          from _ye_lines where public.gl_section(account_type) = 'equity' and public.gl_normal_amount(account_type, d_to_end, c_to_end) <> 0), '[]'::jsonb),
    'accumulated_surplus_prior_years', round(v_ni_prior, 2),
    'net_income_current_year', round(v_ni_year, 2),
    'total_assets', round(v_assets, 2),
    'total_liabilities', round(v_liab, 2),
    'total_equity', round(v_equity + v_ni_prior + v_ni_year, 2),
    'balanced', abs(v_assets - (v_liab + v_equity + v_ni_prior + v_ni_year)) < 0.005
  ) into v_bs;

  -- Income statement vs budget.
  with acct as (
    select l.number, l.name, l.account_type, public.gl_section(l.account_type) sec, l.gl_id,
           public.gl_normal_amount(l.account_type, l.d_year, l.c_year) actual
      from _ye_lines l where public.gl_section(l.account_type) in ('income', 'expense')
  ), bud as (
    select bl.gl_account_id, sum(bl.annual_total) budget
      from public.budget_lines bl where bl.association_id = p_association_id and bl.fiscal_year = p_fiscal_year
     group by bl.gl_account_id
  ), merged as (
    select coalesce(acct.number, g.number) number, coalesce(acct.name, g.name) name,
           coalesce(acct.sec, public.gl_section(g.account_type::text)) sec,
           coalesce(acct.actual, 0) actual, coalesce(bud.budget, 0) budget
      from acct full join bud on bud.gl_account_id = acct.gl_id
      left join public.gl_accounts g on g.id = bud.gl_account_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('number', number, 'name', name, 'section', sec,
            'actual', round(actual, 2), 'budget', round(budget, 2),
            'variance', round(case when sec = 'income' then actual - budget else budget - actual end, 2)) order by sec desc, number, name)
            filter (where actual <> 0 or budget <> 0), '[]'::jsonb),
         coalesce(sum(actual) filter (where sec = 'income'), 0), coalesce(sum(actual) filter (where sec = 'expense'), 0),
         coalesce(sum(budget) filter (where sec = 'income'), 0), coalesce(sum(budget) filter (where sec = 'expense'), 0)
    into v_is, v_income, v_expense, v_budget_income, v_budget_expense
    from merged;

  select coalesce(jsonb_agg(jsonb_build_object('fund', fund, 'income', round(income, 2), 'expense', round(expense, 2), 'net', round(income - expense, 2)) order by fund), '[]'::jsonb)
    into v_funds
    from (select coalesce(fund_account, 'operating') fund,
                 sum(public.gl_normal_amount(account_type, d_year, c_year)) filter (where public.gl_section(account_type) = 'income') income,
                 sum(public.gl_normal_amount(account_type, d_year, c_year)) filter (where public.gl_section(account_type) = 'expense') expense
            from _ye_lines group by 1) f
   where coalesce(income, 0) <> 0 or coalesce(expense, 0) <> 0;

  -- Owner receivables as of year end (charges due minus payments received).
  select jsonb_build_object('total', coalesce(round(sum(bal), 2), 0), 'accounts', count(*),
           'units', coalesce(jsonb_agg(jsonb_build_object('unit', unit_number, 'balance', round(bal, 2)) order by bal desc, unit_number, unit_id), '[]'::jsonb))
    into v_ar
    from (
      select u.id unit_id, u.unit_number,
             coalesce((select sum(c.amount) from public.charges c where c.unit_id = u.id and c.due_date <= w.period_end), 0)
           - coalesce((select sum(p.amount) from public.payments p where p.unit_id = u.id and p.payment_date <= w.period_end), 0) bal
        from public.units u join public.buildings b on b.id = u.building_id
       where b.association_id = p_association_id and u.archived_at is null
    ) x where bal > 0.004;

  select coalesce(jsonb_agg(jsonb_build_object('name', ba.name, 'purpose', ba.purpose,
           'balance', round(coalesce(public.gl_normal_amount(l.account_type, l.d_to_end, l.c_to_end), 0), 2),
           'reconciled_through', ba.last_reconciliation_date) order by ba.name, ba.id), '[]'::jsonb)
    into v_banks
    from public.bank_accounts ba left join _ye_lines l on l.gl_id = ba.gl_account_id
   where ba.association_id = p_association_id and ba.archived_at is null;

  return jsonb_build_object(
    'format', 'portier369.year_end.v1',
    'association', jsonb_build_object('id', a.id, 'name', a.name, 'legal_name', a.legal_name,
      'address', concat_ws(', ', a.address, a.city, concat_ws(' ', a.state, a.zip)), 'tax_id', a.tax_id),
    'fiscal_year', p_fiscal_year, 'period_start', w.period_start, 'period_end', w.period_end,
    'trial_balance', v_tb,
    'balance_sheet', v_bs,
    'income_statement', jsonb_build_object('lines', v_is,
      'total_income', round(v_income, 2), 'total_expense', round(v_expense, 2), 'net_income', round(v_income - v_expense, 2),
      'budget_income', round(v_budget_income, 2), 'budget_expense', round(v_budget_expense, 2), 'budget_net', round(v_budget_income - v_budget_expense, 2)),
    'funds', v_funds,
    'receivables', v_ar,
    'bank_accounts', v_banks
  );
end;
$$;

-- ── Generate / finalize / supersede ────────────────────────────────────────
create or replace function public.generate_year_end_package(p_association_id uuid, p_fiscal_year integer, p_notes text)
returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_portfolio uuid;
  v_readiness jsonb;
  v_snapshot jsonb;
  v_id uuid;
begin
  select portfolio_id into v_portfolio from public.associations where id = p_association_id and archived_at is null;
  if v_portfolio is null then raise exception 'Association not found'; end if;
  if not (public.can_manage_finance(v_portfolio) or public.can_admin_portfolio(v_portfolio) or public.is_platform_operator())
     or not public.can_view_association_row(p_association_id) then
    raise exception 'Only finance staff can prepare year-end packages' using errcode = '42501';
  end if;
  if p_fiscal_year not between 2000 and extract(year from current_date)::integer + 1 then raise exception 'Invalid fiscal year'; end if;
  if exists (select 1 from public.year_end_packages where association_id = p_association_id and fiscal_year = p_fiscal_year and status = 'finalized') then
    raise exception 'This fiscal year is already finalized. Supersede it to prepare a revision.';
  end if;

  v_readiness := public.year_end_readiness(p_association_id, p_fiscal_year);
  v_snapshot := public.build_year_end_snapshot(p_association_id, p_fiscal_year);

  delete from public.year_end_packages where association_id = p_association_id and fiscal_year = p_fiscal_year and status = 'draft';
  insert into public.year_end_packages (portfolio_id, association_id, fiscal_year, period_start, period_end, checklist,
                                        snapshot, snapshot_sha256, notes, generated_by)
  values (v_portfolio, p_association_id, p_fiscal_year, (v_readiness ->> 'period_start')::date, (v_readiness ->> 'period_end')::date,
          v_readiness -> 'items', v_snapshot, encode(sha256(convert_to(v_snapshot::text, 'UTF8')), 'hex'),
          nullif(btrim(coalesce(p_notes, '')), ''), auth.uid())
  returning id into v_id;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (v_portfolio, 'association', p_association_id, 'year_end_package_generated', auth.uid(),
          jsonb_build_object('package_id', v_id, 'fiscal_year', p_fiscal_year));
  return v_id;
end;
$$;

create or replace function public.finalize_year_end_package(p_package_id uuid)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  pkg public.year_end_packages;
  v_readiness jsonb;
  v_current jsonb;
begin
  select * into pkg from public.year_end_packages where id = p_package_id for update;
  if not found then raise exception 'Package not found'; end if;
  if not (public.can_manage_finance(pkg.portfolio_id) or public.can_admin_portfolio(pkg.portfolio_id) or public.is_platform_operator()) then
    raise exception 'Only finance staff can finalize year-end packages' using errcode = '42501';
  end if;
  if pkg.status <> 'draft' then raise exception 'Only a draft package can be finalized'; end if;

  v_readiness := public.year_end_readiness(pkg.association_id, pkg.fiscal_year);
  if not (v_readiness ->> 'ready')::boolean then
    raise exception 'Year-end checks are not complete: %',
      (select string_agg(i ->> 'label', '; ') from jsonb_array_elements(v_readiness -> 'items') i
        where (i ->> 'required')::boolean and not (i ->> 'ok')::boolean);
  end if;
  -- The books must not have moved since the draft was prepared.
  v_current := public.build_year_end_snapshot(pkg.association_id, pkg.fiscal_year);
  if encode(sha256(convert_to(v_current::text, 'UTF8')), 'hex') <> pkg.snapshot_sha256 then
    raise exception 'The books changed after this draft was prepared. Regenerate the package, review it, then finalize.';
  end if;

  update public.year_end_packages
     set status = 'finalized', finalized_by = auth.uid(), finalized_at = now(), checklist = v_readiness -> 'items'
   where id = p_package_id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (pkg.portfolio_id, 'association', pkg.association_id, 'year_end_package_finalized', auth.uid(),
          jsonb_build_object('package_id', pkg.id, 'fiscal_year', pkg.fiscal_year, 'sha256', pkg.snapshot_sha256));
end;
$$;

create or replace function public.supersede_year_end_package(p_package_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare pkg public.year_end_packages;
begin
  select * into pkg from public.year_end_packages where id = p_package_id for update;
  if not found then raise exception 'Package not found'; end if;
  if not (public.can_admin_portfolio(pkg.portfolio_id) or public.is_platform_operator()) then
    raise exception 'Only a portfolio administrator can supersede a finalized package' using errcode = '42501';
  end if;
  if pkg.status <> 'finalized' then raise exception 'Only a finalized package can be superseded'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 20 then raise exception 'Explain why the package is being superseded (20+ characters)'; end if;
  update public.year_end_packages
     set status = 'superseded', superseded_by = auth.uid(), superseded_at = now(), supersede_reason = btrim(p_reason)
   where id = p_package_id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (pkg.portfolio_id, 'association', pkg.association_id, 'year_end_package_superseded', auth.uid(),
          jsonb_build_object('package_id', pkg.id, 'fiscal_year', pkg.fiscal_year, 'reason', btrim(p_reason)));
end;
$$;

create or replace function public.link_year_end_signature(p_package_id uuid, p_signature_request_id uuid)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare pkg public.year_end_packages;
begin
  select * into pkg from public.year_end_packages where id = p_package_id for update;
  if not found or not (public.can_manage_finance(pkg.portfolio_id) or public.can_admin_portfolio(pkg.portfolio_id) or public.is_platform_operator()) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if not exists (select 1 from public.signature_requests r where r.id = p_signature_request_id and r.portfolio_id = pkg.portfolio_id
                   and r.subject_type = 'year_end_package' and r.subject_id = pkg.id) then
    raise exception 'Signature request does not belong to this package';
  end if;
  update public.year_end_packages set signature_request_id = p_signature_request_id where id = p_package_id;
end;
$$;

-- E-signature: allow year-end packages as a signed subject.
alter table public.signature_requests drop constraint if exists signature_requests_subject_type_check;
alter table public.signature_requests add constraint signature_requests_subject_type_check
  check (subject_type in ('document', 'architectural_request', 'board_resolution', 'vendor_agreement', 'management_agreement', 'year_end_package'));

create or replace function public.create_signature_request(
  p_portfolio_id uuid, p_association_id uuid, p_subject_type text, p_subject_id uuid, p_title text, p_message text,
  p_document_kind text, p_document_path text, p_body_text text, p_document_sha256 text, p_signers jsonb,
  p_expires_days integer, p_sequential boolean
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_id uuid; s jsonb; n integer := 0; v_subject_portfolio uuid;
begin
  if not public.can_manage_signatures(p_portfolio_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if p_association_id is not null and not exists (
    select 1 from public.associations a where a.id = p_association_id and a.portfolio_id = p_portfolio_id and a.archived_at is null
  ) then raise exception 'Association is outside your portfolio' using errcode = '42501'; end if;
  if p_association_id is not null and not public.can_view_association_row(p_association_id) then
    raise exception 'Permission denied for this association' using errcode = '42501';
  end if;
  if p_subject_id is not null then
    v_subject_portfolio := case p_subject_type
      when 'architectural_request' then (select portfolio_id from public.architectural_requests where id = p_subject_id)
      when 'management_agreement' then (select portfolio_id from public.management_agreements where id = p_subject_id)
      when 'year_end_package' then (select portfolio_id from public.year_end_packages where id = p_subject_id and status = 'finalized')
      else null end;
    if v_subject_portfolio is distinct from p_portfolio_id then
      raise exception 'Linked record is outside your portfolio' using errcode = '42501';
    end if;
  end if;
  if p_signers is null or jsonb_typeof(p_signers) <> 'array' or jsonb_array_length(p_signers) not between 1 and 20 then
    raise exception 'Add between 1 and 20 signers' using errcode = '22023';
  end if;
  if coalesce(p_expires_days, 0) not between 1 and 90 then raise exception 'Expiry must be 1–90 days' using errcode = '22023'; end if;
  insert into public.signature_requests (
    portfolio_id, association_id, subject_type, subject_id, title, message, document_kind, document_path, body_text,
    document_sha256, sequential, expires_at, created_by
  ) values (
    p_portfolio_id, p_association_id, coalesce(p_subject_type, 'document'), p_subject_id, btrim(p_title),
    nullif(btrim(coalesce(p_message, '')), ''), p_document_kind, p_document_path, p_body_text,
    lower(p_document_sha256), coalesce(p_sequential, false), now() + make_interval(days => p_expires_days), auth.uid()
  ) returning id into v_id;
  for s in select * from jsonb_array_elements(p_signers) loop
    n := n + 1;
    insert into public.signature_signers (request_id, sign_order, name, email, role_label, token_hash)
    values (v_id, n, btrim(s ->> 'name'), lower(btrim(s ->> 'email')), nullif(btrim(coalesce(s ->> 'role_label', '')), ''), lower(s ->> 'token_hash'));
  end loop;
  insert into public.signature_events (request_id, event_type, actor_id, detail)
  values (v_id, 'sent', auth.uid(), jsonb_build_object('signers', n, 'document_sha256', lower(p_document_sha256), 'sequential', coalesce(p_sequential, false)));
  if p_subject_type = 'year_end_package' and p_subject_id is not null then
    update public.year_end_packages set signature_request_id = v_id where id = p_subject_id and portfolio_id = p_portfolio_id;
  end if;
  return v_id;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.association_fiscal_window(uuid, integer)',
    'public.year_end_readiness(uuid, integer)',
    'public.build_year_end_snapshot(uuid, integer)',
    'public.generate_year_end_package(uuid, integer, text)',
    'public.finalize_year_end_package(uuid)',
    'public.supersede_year_end_package(uuid, text)',
    'public.link_year_end_signature(uuid, uuid)',
    'public.create_signature_request(uuid, uuid, text, uuid, text, text, text, text, text, text, jsonb, integer, boolean)'
  ] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
  end loop;
end $$;

revoke all on function public.association_fiscal_window(uuid, integer) from authenticated;
revoke all on function public.build_year_end_snapshot(uuid, integer) from authenticated;
grant execute on function public.year_end_readiness(uuid, integer) to authenticated, service_role;
grant execute on function public.generate_year_end_package(uuid, integer, text) to authenticated, service_role;
grant execute on function public.finalize_year_end_package(uuid) to authenticated, service_role;
grant execute on function public.supersede_year_end_package(uuid, text) to authenticated, service_role;
grant execute on function public.link_year_end_signature(uuid, uuid) to authenticated, service_role;
grant execute on function public.create_signature_request(uuid, uuid, text, uuid, text, text, text, text, text, text, jsonb, integer, boolean) to authenticated, service_role;
