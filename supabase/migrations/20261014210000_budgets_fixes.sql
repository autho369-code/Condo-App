-- Budgets deep check (2026-10-13).
--
-- 1. budget_lines are written only through save_budget_worksheet (and the
--    other budget functions): a direct table write skipped its checks
--    (negative amounts, an expense line saved as income, a cash account in
--    the budget). Nothing in the app writes the table directly; production
--    has no budget lines yet.
-- 2. apply_assessment_update no longer silently ends a later year's schedule:
--    it refuses while assessments in this charge already start after the
--    effective date (apply budgets in date order), and refuses the same update
--    twice (a double submit posted it twice).
-- 3. adopt_budget refuses a budget that is already adopted (re-adopting
--    replaced the original adoption record).
-- 4. assessment_allocation: the per-period amounts add up to the budget per
--    period; the leftover cents go to the unit with the largest share.
-- 5. report_data_budget_detail defaults to the association's fiscal year (not
--    the calendar year), like the other budget reports.
-- 6. apply_dues_increase_checked: the charge category must belong to this
--    association's company (or be a global one).

-- 1. ---------------------------------------------------------------------------
revoke insert, update, delete, truncate on public.budget_lines from anon, authenticated;

-- 2. ---------------------------------------------------------------------------
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.apply_assessment_update(uuid,integer,uuid,uuid,text,text,date)'::regprocedure), E'\r\n', E'\n');
  v_old_decl text := E'  v_annual numeric;\nbegin';
  v_new_decl text := E'  v_annual numeric;\n  v_later date;\nbegin';
  v_old text := E'  insert into public.dues_increases (portfolio_id, association_id, name, status, effective_date, notes, posted_at, posted_by, created_by)';
  v_new text := E'  -- The same update twice (a double submit) changes nothing.\n'
             || E'  if exists (select 1 from public.unit_recurring_charges rc\n'
             || E'               join public.units un on un.id = rc.unit_id\n'
             || E'               join public.buildings bd on bd.id = un.building_id\n'
             || E'              where bd.association_id = p_association_id and rc.charge_category_id = p_charge_category_id\n'
             || E'                and rc.active and rc.identifier = ''budget:'' || p_fiscal_year and rc.start_date = p_effective_date) then\n'
             || E'    raise exception ''The FY% assessments are already applied from %'', p_fiscal_year, p_effective_date using errcode = ''23505'';\n'
             || E'  end if;\n'
             || E'  -- Never end a schedule that starts later (e.g. next year''s): apply in date order.\n'
             || E'  select min(rc.start_date) into v_later\n'
             || E'    from public.unit_recurring_charges rc\n'
             || E'    join public.units un on un.id = rc.unit_id\n'
             || E'    join public.buildings bd on bd.id = un.building_id\n'
             || E'   where bd.association_id = p_association_id and rc.charge_category_id = p_charge_category_id\n'
             || E'     and rc.active and rc.start_date > p_effective_date;\n'
             || E'  if v_later is not null then\n'
             || E'    raise exception ''Assessments in this charge are already scheduled from %. Apply budgets in date order, or end that schedule first.'', v_later using errcode = ''55000'';\n'
             || E'  end if;\n\n'
             || v_old;
begin
  if position('v_later date;' in v_def) > 0 then
    raise notice 'apply_assessment_update already patched';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old_decl), 1) <> 2 or array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'apply_assessment_update: expected text not found exactly once';
  end if;
  execute replace(replace(v_def, v_old_decl, v_new_decl), v_old, v_new);
end
$do$;

-- 3. ---------------------------------------------------------------------------
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.adopt_budget(uuid,integer,text)'::regprocedure), E'\r\n', E'\n');
  v_old text := E'  select portfolio_id into v_portfolio from public.associations where id = p_association_id;\n  insert into public.association_budgets';
  v_new text := E'  if exists (select 1 from public.association_budgets where association_id = p_association_id and fiscal_year = p_fiscal_year and status = ''adopted'') then\n'
             || E'    raise exception ''The FY% budget is already adopted'', p_fiscal_year using errcode = ''55000'';\n'
             || E'  end if;\n'
             || v_old;
begin
  if position('budget is already adopted' in v_def) > 0 then
    raise notice 'adopt_budget already patched';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'adopt_budget: expected text not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

-- 4. ---------------------------------------------------------------------------
create or replace function public.assessment_allocation(
  p_association_id uuid, p_fiscal_year integer, p_budget_gl_account_id uuid,
  p_charge_category_id uuid, p_method text, p_frequency text)
returns table(unit_id uuid, unit_number text, occupancy_id uuid, owner_name text, basis numeric,
              share_pct numeric, annual_amount numeric, period_amount numeric, current_amount numeric,
              current_frequency text, budget_annual numeric)
language plpgsql
stable security definer
set search_path = pg_catalog, public
as $function$
declare v_annual numeric; v_periods integer;
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
  ), tot as (
    select sum(b) as t, bool_and(b is not null) as complete from u
  ), raw as (
    select u.id, u.unit_number, u.b,
           case when tot.t > 0 and u.b is not null then round(v_annual * u.b / tot.t / v_periods, 2) end as p,
           tot.t, tot.complete,
           row_number() over (order by u.b desc nulls last, u.unit_number, u.id) as rn
      from u cross join tot
  ), fix as (
    -- What one billing period must add up to, and the cents rounding left over;
    -- the leftover goes to the unit with the largest share (only when every
    -- unit has a basis, so the totals are meant to add up).
    select round(v_annual / v_periods, 2) - coalesce(sum(p), 0) as leftover from raw
  ), alloc as (
    select raw.*, case when raw.p is not null and raw.rn = 1 and raw.complete then raw.p + fix.leftover else raw.p end as pa
      from raw cross join fix
  )
  select alloc.id, alloc.unit_number, occ.id, ow.full_name, alloc.b,
         case when alloc.t > 0 and alloc.b is not null then round(alloc.b / alloc.t * 100, 4) end,
         alloc.pa * v_periods,
         alloc.pa,
         cur.amount, cur.frequency::text, v_annual
    from alloc
    left join lateral (
      select o.id, o.owner_id from public.occupancies o
       where o.unit_id = alloc.id and o.status::text = 'current' and o.occupancy_type::text = 'owner'
       order by o.is_primary desc, o.move_in_date desc nulls last, o.created_at desc limit 1
    ) occ on true
    left join public.owners ow on ow.id = occ.owner_id
    left join lateral (
      select rc.amount, rc.frequency from public.unit_recurring_charges rc
       where rc.unit_id = alloc.id and rc.charge_category_id = p_charge_category_id and rc.active
         and (rc.end_date is null or rc.end_date >= current_date)
       order by rc.start_date desc limit 1
    ) cur on true
   order by alloc.unit_number;
end
$function$;

-- 5. ---------------------------------------------------------------------------
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.report_data_budget_detail(uuid,jsonb)'::regprocedure), E'\r\n', E'\n');
  v_old text := E'coalesce(nullif(p_params->>''fiscal_year'','''')::int, extract(year from prm.dt)::int)';
  v_new text := E'coalesce(nullif(p_params->>''fiscal_year'','''')::int, public.association_fiscal_year_of(a.id, prm.dt))';
begin
  if position('association_fiscal_year_of(a.id, prm.dt)' in v_def) > 0 then
    raise notice 'report_data_budget_detail already patched';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'report_data_budget_detail: expected text not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

-- 6. ---------------------------------------------------------------------------
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.apply_dues_increase_checked(uuid,uuid,text,numeric,date,boolean,jsonb)'::regprocedure), E'\r\n', E'\n');
  v_old text := E'       and (c.association_id is null or c.association_id = p_association_id)\n  ) then';
  v_new text := E'       and (c.association_id is null or c.association_id = p_association_id)\n'
             || E'       and (c.portfolio_id is null or c.portfolio_id = (select a.portfolio_id from public.associations a where a.id = p_association_id))\n  ) then';
begin
  if position('c.portfolio_id is null or c.portfolio_id' in v_def) > 0 then
    raise notice 'apply_dues_increase_checked already patched';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'apply_dues_increase_checked: expected text not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

-- 7. ---------------------------------------------------------------------------
-- The checks in 2 and 3 run under a per-association lock, so two updates or two
-- adoptions sent at the same moment can't both pass them.
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.apply_assessment_update(uuid,integer,uuid,uuid,text,text,date)'::regprocedure), E'\r\n', E'\n');
  v_old text := E'  -- The same update twice (a double submit) changes nothing.\n';
  v_new text := E'  perform pg_advisory_xact_lock(hashtext(''assessment_update:'' || p_association_id::text));\n' || v_old;
begin
  if position('assessment_update:'' || p_association_id' in v_def) > 0 then
    raise notice 'apply_assessment_update lock already added';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'apply_assessment_update: lock anchor not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

do $do$
declare
  v_def text := replace(pg_get_functiondef('public.adopt_budget(uuid,integer,text)'::regprocedure), E'\r\n', E'\n');
  v_old text := E'  if exists (select 1 from public.association_budgets where association_id = p_association_id and fiscal_year = p_fiscal_year and status = ''adopted'') then\n';
  v_new text := E'  perform pg_advisory_xact_lock(hashtext(''budget_adopt:'' || p_association_id::text || '':'' || p_fiscal_year::text));\n' || v_old;
begin
  if position('budget_adopt:'' || p_association_id' in v_def) > 0 then
    raise notice 'adopt_budget lock already added';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'adopt_budget: lock anchor not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;
