-- GL / budget audit fixes.
--
-- get_budget_vs_actuals started from budget_lines and only joined actuals, so
-- posted activity on income/expense accounts with no budget line for the
-- fiscal year never appeared and the report's totals understated actuals.
-- Unbudgeted accounts with non-zero activity are now returned too, with a
-- zero budget and a null budget_line_id (same idea as the merged income
-- statement in build_year_end_snapshot). Signature and return type unchanged.

create or replace function public.get_budget_vs_actuals(p_association_id uuid, p_fiscal_year integer)
 returns table(budget_line_id uuid, gl_account_id uuid, gl_account_number integer, gl_account_name text, category text, notes text, monthly_budget numeric[], monthly_actuals numeric[], monthly_variance numeric[], annual_budget numeric, annual_actual numeric, annual_variance numeric, annual_variance_pct numeric)
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
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
  ), budgeted as (
    select bl.id, bl.gl_account_id, ga.number as gl_number, ga.name as gl_name, bl.category::text as category,
           bl.notes, bl.monthly_amounts::numeric[] as monthly_amounts
      from public.budget_lines bl
      join public.gl_accounts ga on ga.id = bl.gl_account_id
      join public.associations a on a.id = bl.association_id
     where bl.association_id = p_association_id and bl.fiscal_year = p_fiscal_year
       and ga.portfolio_id = a.portfolio_id and (ga.association_id is null or ga.association_id = bl.association_id)
  ), unbudgeted as (
    select null::uuid as id, ga.id as gl_account_id, ga.number as gl_number, ga.name as gl_name,
           public.gl_section(ga.account_type::text) as category, null::text as notes,
           array_fill(0::numeric, array[12]) as monthly_amounts
      from public.gl_accounts ga
     where ga.id in (select act.gid from act group by act.gid having sum(act.amt) <> 0)
       and public.gl_section(ga.account_type::text) in ('income', 'expense')
       and not exists (select 1 from budgeted b where b.gl_account_id = ga.id)
  ), lines as (
    select x.*,
           (select array_agg(coalesce(a.amt, 0) order by g.i) from generate_series(1, 12) g(i)
              left join act a on a.gid = x.gl_account_id and a.idx = g.i) as actuals
      from (select * from budgeted union all select * from unbudgeted) x
  )
  select l.id, l.gl_account_id, l.gl_number, l.gl_name, l.category, l.notes,
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
end $function$;
