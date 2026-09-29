-- Budget worksheet, adoption, and "update assessments" (budget → unit dues).
--
-- Conventions:
--   * budget_lines.monthly_amounts[i] is the i-th month of the association's
--     fiscal year (association_fiscal_window). For calendar-year associations
--     this is January..December, so existing data keeps its meaning.
--   * Fiscal year N is the fiscal year that ENDS in calendar year N.
--   * Regular assessments bill through unit_recurring_charges (posted daily by
--     post_unit_recurring_charges). occupancies.dues_amount is the
--     per-period figure (with dues_frequency) shown to owners; kept in sync here.

-- ── Budget header: draft / adopted ──────────────────────────────────────────
create table if not exists public.association_budgets (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  fiscal_year integer not null check (fiscal_year between 2000 and 2100),
  status text not null default 'draft' check (status in ('draft', 'adopted')),
  adopted_at timestamptz,
  adopted_by uuid references auth.users(id) on delete set null,
  adoption_note text check (length(adoption_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (association_id, fiscal_year)
);
alter table public.association_budgets enable row level security;
drop policy if exists association_budgets_read on public.association_budgets;
create policy association_budgets_read on public.association_budgets for select to authenticated
  using (public.can_read_association_budget(association_id));
revoke all on public.association_budgets from anon;
grant select on public.association_budgets to authenticated;

-- Adopted budgets are frozen; reopen_budget() is the audited way back.
create or replace function public.guard_adopted_budget_lines()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare r record;
begin
  for r in select * from (values (case when tg_op <> 'INSERT' then old.association_id end, case when tg_op <> 'INSERT' then old.fiscal_year end),
                                 (case when tg_op <> 'DELETE' then new.association_id end, case when tg_op <> 'DELETE' then new.fiscal_year end)) v(aid, fy)
           where v.aid is not null loop
    if exists (select 1 from public.association_budgets b where b.association_id = r.aid and b.fiscal_year = r.fy and b.status = 'adopted') then
      raise exception 'The FY% budget is adopted. Reopen it before changing lines.', r.fy using errcode = '55000';
    end if;
  end loop;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_guard_adopted_budget_lines on public.budget_lines;
create trigger trg_guard_adopted_budget_lines before insert or update or delete on public.budget_lines
  for each row execute function public.guard_adopted_budget_lines();

-- Month index (1..12) of a date inside an association's fiscal year.
create or replace function public.fiscal_month_index(p_period_start date, p_date date)
returns integer language sql immutable set search_path = pg_catalog, public as $$
  select ((extract(year from p_date)::int * 12 + extract(month from p_date)::int)
        - (extract(year from p_period_start)::int * 12 + extract(month from p_period_start)::int)) + 1;
$$;

-- ── Worksheet sources: prior budget / prior actuals (posted GL) ─────────────
create or replace function public.budget_worksheet_source(p_association_id uuid, p_fiscal_year integer, p_source text)
returns table(gl_account_id uuid, monthly_amounts numeric[])
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare w record;
begin
  if p_association_id is null or p_fiscal_year not between 2000 and 2100 then
    raise exception 'Invalid budget scope' using errcode = '22023';
  end if;
  if not public.can_read_association_budget(p_association_id) then
    raise exception 'Not authorized for this association budget' using errcode = '42501';
  end if;

  if p_source = 'prior_budget' then
    return query select bl.gl_account_id, bl.monthly_amounts from public.budget_lines bl
      where bl.association_id = p_association_id and bl.fiscal_year = p_fiscal_year - 1;
  elsif p_source in ('prior_actuals', 'current_actuals') then
    select * into w from public.association_fiscal_window(p_association_id,
      case when p_source = 'prior_actuals' then p_fiscal_year - 1 else p_fiscal_year end);
    return query
      with m as (
        select jl.gl_account_id as gid, public.fiscal_month_index(w.period_start, je.entry_date) as idx,
               sum(public.gl_normal_amount(ga.account_type::text, jl.debit_amount, jl.credit_amount)) as amt
          from public.journal_lines jl
          join public.journal_entries je on je.id = jl.entry_id and je.posted
          join public.gl_accounts ga on ga.id = jl.gl_account_id
         where jl.association_id = p_association_id
           and je.entry_date between w.period_start and w.period_end
           and public.gl_section(ga.account_type::text) in ('income', 'expense')
         group by 1, 2
      )
      select m.gid, array_agg(round(greatest(coalesce(x.amt, 0), 0), 2) order by g.i)
        from (select distinct gid from m) m
        cross join generate_series(1, 12) g(i)
        left join m x on x.gid = m.gid and x.idx = g.i
       group by m.gid;
  else
    raise exception 'Unknown source %', p_source using errcode = '22023';
  end if;
end $$;

-- ── Save the whole worksheet in one call ────────────────────────────────────
create or replace function public.save_budget_worksheet(p_association_id uuid, p_fiscal_year integer, p_lines jsonb)
returns integer
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_portfolio uuid;
  r record;
  v_amounts numeric[];
  v_section text;
  n integer := 0;
  v_income numeric := 0;
  v_expense numeric := 0;
begin
  if p_association_id is null or p_fiscal_year not between 2000 and 2100 then
    raise exception 'Invalid budget scope' using errcode = '22023';
  end if;
  if not public.can_mutate_association_budget(p_association_id) then
    raise exception 'Finance authorization required' using errcode = '42501';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) > 1000 then
    raise exception 'Send between 0 and 1000 lines' using errcode = '22023';
  end if;
  select portfolio_id into v_portfolio from public.associations where id = p_association_id;

  if exists (select 1 from public.association_budgets where association_id = p_association_id and fiscal_year = p_fiscal_year and status = 'adopted') then
    raise exception 'The FY% budget is adopted. Reopen it before editing.', p_fiscal_year using errcode = '55000';
  end if;
  insert into public.association_budgets (portfolio_id, association_id, fiscal_year)
  values (v_portfolio, p_association_id, p_fiscal_year)
  on conflict (association_id, fiscal_year) do update set updated_at = now();

  for r in select (x->>'gl_account_id')::uuid as gid, x->'monthly_amounts' as amts, nullif(btrim(x->>'notes'), '') as notes
             from jsonb_array_elements(p_lines) x loop
    if r.gid is null or not public.budget_gl_account_scope_valid(p_association_id, r.gid) then
      raise exception 'A GL account does not belong to this association' using errcode = '22023';
    end if;
    select public.gl_section(account_type::text) into v_section from public.gl_accounts where id = r.gid;
    if v_section not in ('income', 'expense') then
      raise exception 'Only income and expense accounts can be budgeted' using errcode = '22023';
    end if;
    if r.amts is null or jsonb_typeof(r.amts) <> 'array' or jsonb_array_length(r.amts) <> 12 then
      raise exception 'Each line needs 12 monthly amounts' using errcode = '22023';
    end if;
    begin
      select array_agg(round(v::numeric, 2) order by o) into v_amounts from jsonb_array_elements_text(r.amts) with ordinality t(v, o);
    exception when others then
      raise exception 'Monthly amounts must be numbers' using errcode = '22023';
    end;
    if exists (select 1 from unnest(v_amounts) a where a is null or a::text = 'NaN' or a < 0 or a > 1000000000) then
      raise exception 'Monthly amounts must be between 0 and 1,000,000,000' using errcode = '22023';
    end if;
    if length(coalesce(r.notes, '')) > 10000 then
      raise exception 'Notes are limited to 10,000 characters' using errcode = '22023';
    end if;

    if (select sum(a) from unnest(v_amounts) a) = 0 and r.notes is null then
      delete from public.budget_lines where association_id = p_association_id and gl_account_id = r.gid and fiscal_year = p_fiscal_year;
    else
      insert into public.budget_lines (association_id, gl_account_id, fiscal_year, monthly_amounts, category, notes)
      values (p_association_id, r.gid, p_fiscal_year, v_amounts, v_section::public.budget_category, r.notes)
      on conflict (association_id, gl_account_id, fiscal_year)
      do update set monthly_amounts = excluded.monthly_amounts, category = excluded.category, notes = excluded.notes, updated_at = now();
      n := n + 1;
      if v_section = 'income' then v_income := v_income + (select sum(a) from unnest(v_amounts) a);
      else v_expense := v_expense + (select sum(a) from unnest(v_amounts) a); end if;
    end if;
  end loop;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_portfolio, 'association', p_association_id, 'budget_worksheet_saved', auth.uid(),
          (select email from auth.users where id = auth.uid()),
          jsonb_build_object('fiscal_year', p_fiscal_year, 'lines', n, 'income', v_income, 'expense', v_expense));
  return n;
end $$;

-- ── Adopt / reopen ──────────────────────────────────────────────────────────
create or replace function public.adopt_budget(p_association_id uuid, p_fiscal_year integer, p_note text default null)
returns void
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_portfolio uuid;
begin
  if not public.can_mutate_association_budget(p_association_id) then
    raise exception 'Finance authorization required' using errcode = '42501';
  end if;
  if length(coalesce(p_note, '')) > 2000 then raise exception 'Note is too long' using errcode = '22023'; end if;
  if not exists (select 1 from public.budget_lines where association_id = p_association_id and fiscal_year = p_fiscal_year) then
    raise exception 'Add budget lines before adopting' using errcode = '22023';
  end if;
  select portfolio_id into v_portfolio from public.associations where id = p_association_id;
  insert into public.association_budgets (portfolio_id, association_id, fiscal_year, status, adopted_at, adopted_by, adoption_note)
  values (v_portfolio, p_association_id, p_fiscal_year, 'adopted', now(), auth.uid(), nullif(btrim(p_note), ''))
  on conflict (association_id, fiscal_year) do update
    set status = 'adopted', adopted_at = now(), adopted_by = auth.uid(), adoption_note = nullif(btrim(p_note), ''), updated_at = now();
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_portfolio, 'association', p_association_id, 'budget_adopted', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('fiscal_year', p_fiscal_year, 'note', p_note,
            'income', (select sum(annual_total) from public.budget_lines where association_id = p_association_id and fiscal_year = p_fiscal_year and category = 'income'),
            'expense', (select sum(annual_total) from public.budget_lines where association_id = p_association_id and fiscal_year = p_fiscal_year and category = 'expense')));
end $$;

create or replace function public.reopen_budget(p_association_id uuid, p_fiscal_year integer, p_reason text)
returns void
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_portfolio uuid;
begin
  if not public.can_mutate_association_budget(p_association_id) then
    raise exception 'Finance authorization required' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 or length(p_reason) > 2000 then
    raise exception 'Give a reason for reopening the adopted budget' using errcode = '22023';
  end if;
  update public.association_budgets set status = 'draft', updated_at = now()
   where association_id = p_association_id and fiscal_year = p_fiscal_year and status = 'adopted'
  returning portfolio_id into v_portfolio;
  if not found then raise exception 'This budget is not adopted' using errcode = '22023'; end if;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_portfolio, 'association', p_association_id, 'budget_reopened', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('fiscal_year', p_fiscal_year, 'reason', p_reason));
end $$;

-- ── Assessment allocation (preview) ─────────────────────────────────────────
-- Allocates the adopted budget amount of one income GL line across the
-- association's active units by ownership %, equally, or by square feet.
create or replace function public.assessment_allocation(
  p_association_id uuid, p_fiscal_year integer, p_budget_gl_account_id uuid,
  p_charge_category_id uuid, p_method text, p_frequency text)
returns table(unit_id uuid, unit_number text, occupancy_id uuid, owner_name text, basis numeric, share_pct numeric,
              annual_amount numeric, period_amount numeric, current_amount numeric, current_frequency text, budget_annual numeric)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_annual numeric; v_periods integer; v_total_basis numeric;
begin
  if not public.can_mutate_association_budget(p_association_id) then
    raise exception 'Finance authorization required' using errcode = '42501';
  end if;
  if p_method not in ('ownership_pct', 'equal', 'sqft') then raise exception 'Unknown allocation method' using errcode = '22023'; end if;
  v_periods := case p_frequency when 'monthly' then 12 when 'quarterly' then 4 when 'annually' then 1 end;
  if v_periods is null then raise exception 'Frequency must be monthly, quarterly or annually' using errcode = '22023'; end if;

  select bl.annual_total into v_annual from public.budget_lines bl
   where bl.association_id = p_association_id and bl.fiscal_year = p_fiscal_year and bl.gl_account_id = p_budget_gl_account_id and bl.category = 'income';
  if v_annual is null then raise exception 'That income account has no line in the FY% budget', p_fiscal_year using errcode = '22023'; end if;

  return query
  with u as (
    select un.id, un.unit_number,
           case p_method when 'ownership_pct' then nullif(un.ownership_pct, 0)
                         when 'sqft' then nullif(un.sqft, 0)::numeric
                         else 1::numeric end as b
      from public.units un join public.buildings bd on bd.id = un.building_id
     where bd.association_id = p_association_id and un.archived_at is null
  ), tot as (select sum(b) as t from u)
  select u.id, u.unit_number, occ.id, ow.full_name, u.b,
         case when tot.t > 0 and u.b is not null then round(u.b / tot.t * 100, 4) end,
         case when tot.t > 0 and u.b is not null then round(v_annual * u.b / tot.t, 2) end,
         case when tot.t > 0 and u.b is not null then round(v_annual * u.b / tot.t / v_periods, 2) end,
         cur.amount, cur.frequency::text, v_annual
    from u cross join tot
    left join lateral (
      select o.id, o.owner_id from public.occupancies o
       where o.unit_id = u.id and o.status::text = 'current' and o.occupancy_type::text = 'owner'
       order by o.is_primary desc, o.move_in_date desc nulls last, o.created_at desc limit 1
    ) occ on true
    left join public.owners ow on ow.id = occ.owner_id
    left join lateral (
      select rc.amount, rc.frequency from public.unit_recurring_charges rc
       where rc.unit_id = u.id and rc.charge_category_id = p_charge_category_id and rc.active
         and (rc.end_date is null or rc.end_date >= current_date)
       order by rc.start_date desc limit 1
    ) cur on true
   order by u.unit_number;
end $$;

-- ── Apply: end current dues subscriptions and start the new ones ────────────
create or replace function public.apply_assessment_update(
  p_association_id uuid, p_fiscal_year integer, p_budget_gl_account_id uuid,
  p_charge_category_id uuid, p_method text, p_frequency text, p_effective_date date)
returns uuid
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_portfolio uuid;
  v_cat record;
  w record;
  r record;
  v_increase uuid;
  n integer := 0;
  v_missing integer;
  v_units integer;
  v_total numeric := 0;
  v_annual numeric;
begin
  if not public.can_mutate_association_budget(p_association_id) then
    raise exception 'Finance authorization required' using errcode = '42501';
  end if;
  select portfolio_id into v_portfolio from public.associations where id = p_association_id;
  if not exists (select 1 from public.association_budgets where association_id = p_association_id and fiscal_year = p_fiscal_year and status = 'adopted') then
    raise exception 'Adopt the FY% budget before updating assessments', p_fiscal_year using errcode = '55000';
  end if;
  select * into v_cat from public.charge_categories
   where id = p_charge_category_id and active and archived_at is null
     and (portfolio_id is null or portfolio_id = v_portfolio)
     and (association_id is null or association_id = p_association_id);
  if not found then raise exception 'Choose an active charge category for this association' using errcode = '22023'; end if;
  if v_cat.charge_type::text not in ('assessment', 'special_assessment') then
    raise exception 'The charge category must be an assessment' using errcode = '22023';
  end if;
  select * into w from public.association_fiscal_window(p_association_id, p_fiscal_year);
  if p_effective_date is null or p_effective_date < current_date or p_effective_date > w.period_end then
    raise exception 'The effective date must be between today and the end of FY% (%)', p_fiscal_year, w.period_end using errcode = '22023';
  end if;

  select count(*), count(*) filter (where a.period_amount is null), max(a.budget_annual) into v_units, v_missing, v_annual
    from public.assessment_allocation(p_association_id, p_fiscal_year, p_budget_gl_account_id, p_charge_category_id, p_method, p_frequency) a;
  if v_units = 0 then raise exception 'This association has no active units' using errcode = '22023'; end if;
  if v_missing > 0 then
    raise exception '% unit(s) have no % — fix the unit records or choose another method', v_missing,
      case p_method when 'sqft' then 'square footage' else 'ownership percentage' end using errcode = '22023';
  end if;
  if v_annual <= 0 then raise exception 'The budgeted amount must be greater than zero' using errcode = '22023'; end if;

  insert into public.dues_increases (portfolio_id, association_id, name, status, effective_date, notes, posted_at, posted_by, created_by)
  values (v_portfolio, p_association_id, format('FY%s assessments', p_fiscal_year), 'posted', p_effective_date,
          format('From the adopted FY%s budget; %s allocation, billed %s.', p_fiscal_year, replace(p_method, '_', ' '), p_frequency),
          now(), auth.uid(), auth.uid())
  returning id into v_increase;

  for r in select * from public.assessment_allocation(p_association_id, p_fiscal_year, p_budget_gl_account_id, p_charge_category_id, p_method, p_frequency) loop
    -- Stop the current subscriptions in this category from the effective date.
    update public.unit_recurring_charges rc
       set active = case when rc.start_date >= p_effective_date then false else rc.active end,
           end_date = case when rc.start_date >= p_effective_date then rc.start_date else p_effective_date - 1 end,
           updated_at = now()
     where rc.unit_id = r.unit_id and rc.charge_category_id = p_charge_category_id and rc.active
       and (rc.end_date is null or rc.end_date >= p_effective_date);

    if r.period_amount > 0 then
      insert into public.unit_recurring_charges (unit_id, charge_category_id, amount, frequency, start_date, next_post_date, memo, active, created_by, identifier)
      values (r.unit_id, p_charge_category_id, r.period_amount, p_frequency::public.recurring_frequency, p_effective_date, p_effective_date,
              format('FY%s %s', p_fiscal_year, v_cat.name), true, auth.uid(), 'budget:' || p_fiscal_year);
    end if;

    -- Every current owner record of the unit shows the same dues figure.
    update public.occupancies
       set dues_amount = r.period_amount,
           dues_frequency = p_frequency::public.recurring_frequency,
           last_dues_increase_date = p_effective_date,
           last_dues_increase_amount = r.period_amount - coalesce(dues_amount, 0),
           updated_at = now()
     where unit_id = r.unit_id and status::text = 'current' and occupancy_type::text = 'owner';
    if r.occupancy_id is not null then
      insert into public.dues_increase_lines (dues_increase_id, occupancy_id, unit_id, old_amount, new_amount, change_type, change_value)
      values (v_increase, r.occupancy_id, r.unit_id, coalesce(r.current_amount, 0), r.period_amount, 'flat', r.period_amount - coalesce(r.current_amount, 0));
    end if;
    n := n + 1;
    v_total := v_total + r.annual_amount;
  end loop;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_portfolio, 'association', p_association_id, 'assessments_updated', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('fiscal_year', p_fiscal_year, 'dues_increase_id', v_increase, 'units', n, 'method', p_method,
                             'frequency', p_frequency, 'effective_date', p_effective_date, 'charge_category_id', p_charge_category_id,
                             'budgeted', v_annual, 'allocated', v_total));
  return v_increase;
end $$;

-- ── Budget vs actuals: fiscal months + posted GL actuals ────────────────────
-- Previously compared against bills/charges by calendar month, which missed
-- journal entries and ignored non-calendar fiscal years.
create or replace function public.get_budget_vs_actuals(p_association_id uuid, p_fiscal_year integer)
returns table(budget_line_id uuid, gl_account_id uuid, gl_account_number integer, gl_account_name text, category text, notes text,
              monthly_budget numeric[], monthly_actuals numeric[], monthly_variance numeric[],
              annual_budget numeric, annual_actual numeric, annual_variance numeric, annual_variance_pct numeric)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare w record;
begin
  if p_association_id is null or p_fiscal_year is null or p_fiscal_year not between 1900 and 2200 then
    raise exception 'Invalid budget scope' using errcode = '22023';
  end if;
  if not public.can_read_association_budget(p_association_id) then
    raise exception 'Not authorized for this association budget' using errcode = '42501';
  end if;
  select * into w from public.association_fiscal_window(p_association_id, p_fiscal_year);

  return query
  with act as (
    select jl.gl_account_id as gid, public.fiscal_month_index(w.period_start, je.entry_date) as idx,
           sum(public.gl_normal_amount(ga.account_type::text, jl.debit_amount, jl.credit_amount)) as amt
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted
      join public.gl_accounts ga on ga.id = jl.gl_account_id
     where jl.association_id = p_association_id and je.entry_date between w.period_start and w.period_end
     group by 1, 2
  ), lines as (
    select bl.*, ga.number as gl_number, ga.name as gl_name,
           (select array_agg(coalesce(a.amt, 0) order by g.i) from generate_series(1, 12) g(i)
              left join act a on a.gid = bl.gl_account_id and a.idx = g.i) as actuals
      from public.budget_lines bl
      join public.gl_accounts ga on ga.id = bl.gl_account_id
      join public.associations a on a.id = bl.association_id
     where bl.association_id = p_association_id and bl.fiscal_year = p_fiscal_year
       and ga.portfolio_id = a.portfolio_id and (ga.association_id is null or ga.association_id = bl.association_id)
  )
  select l.id, l.gl_account_id, l.gl_number, l.gl_name, l.category::text, l.notes,
         l.monthly_amounts, l.actuals,
         (select array_agg(l.actuals[i] - coalesce(l.monthly_amounts[i], 0) order by i) from generate_series(1, 12) i),
         (select sum(x) from unnest(l.monthly_amounts) x),
         (select sum(x) from unnest(l.actuals) x),
         (select sum(x) from unnest(l.actuals) x) - (select sum(x) from unnest(l.monthly_amounts) x),
         case when (select sum(x) from unnest(l.monthly_amounts) x) <> 0
              then round(((select sum(x) from unnest(l.actuals) x) - (select sum(x) from unnest(l.monthly_amounts) x))
                         / (select sum(x) from unnest(l.monthly_amounts) x) * 100, 1)
              else 0 end
    from lines l
   order by l.gl_number;
end $$;

-- ── Grants ──────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.guard_adopted_budget_lines()',
    'public.budget_worksheet_source(uuid, integer, text)',
    'public.save_budget_worksheet(uuid, integer, jsonb)',
    'public.adopt_budget(uuid, integer, text)',
    'public.reopen_budget(uuid, integer, text)',
    'public.assessment_allocation(uuid, integer, uuid, uuid, text, text)',
    'public.apply_assessment_update(uuid, integer, uuid, uuid, text, text, date)',
    'public.get_budget_vs_actuals(uuid, integer)'
  ] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
    if f <> 'public.guard_adopted_budget_lines()' then
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;
end $$;
revoke all on function public.fiscal_month_index(date, date) from public, anon;
grant execute on function public.fiscal_month_index(date, date) to authenticated, service_role;

-- post_dues_increase() is SECURITY DEFINER with no authorization check and
-- was executable by any signed-in user. The app never calls it; restrict it
-- to the service role.
revoke all on function public.post_dues_increase(uuid) from public, anon, authenticated;
grant execute on function public.post_dues_increase(uuid) to service_role;
