-- Speed: budget actuals add up debits and credits before the GL helpers run.
--
-- gl_normal_amount, fiscal_month_index and gl_section are one-line SQL
-- functions, but each carries SET search_path (security lint), which stops
-- Postgres inlining them, so every call is a full function call. Budget vs
-- actuals, the budget worksheet's actuals source and the annual budget
-- forecast report called them once per journal line: at 2,000 units
-- (24,000 lines, rolled back) get_budget_vs_actuals took 1.45 s, 1.2 s of it
-- in those calls. The lines are now summed per account and month (or per
-- account) first and the helpers run once per group. Same results: the
-- normal amount is linear (credit minus debit, or debit minus credit, nulls
-- as 0) and the fiscal month depends only on the calendar month. The year-end
-- snapshot already summed first. Patched in place: each old block must match
-- exactly once.

do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  -- 1. get_budget_vs_actuals
  v_def := pg_get_functiondef('public.get_budget_vs_actuals(uuid, integer)'::regprocedure);
  v_old := $o$    select jl.gl_account_id as gid, public.fiscal_month_index(w.period_start, je.entry_date) as idx,
           sum(public.gl_normal_amount(ga.account_type::text, jl.debit_amount, jl.credit_amount)) as amt
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted
      join public.gl_accounts ga on ga.id = jl.gl_account_id
     where jl.association_id = p_association_id and je.entry_date between w.period_start and w.period_end
     group by 1, 2$o$;
  v_new := $n$    select s.gid, public.fiscal_month_index(w.period_start, s.mon) as idx,
           public.gl_normal_amount(s.account_type, s.d, s.c) as amt
      from (select jl.gl_account_id as gid, ga.account_type::text as account_type,
                   date_trunc('month', je.entry_date)::date as mon,
                   sum(jl.debit_amount) as d, sum(jl.credit_amount) as c
              from public.journal_lines jl
              join public.journal_entries je on je.id = jl.entry_id and je.posted
              join public.gl_accounts ga on ga.id = jl.gl_account_id
             where jl.association_id = p_association_id and je.entry_date between w.period_start and w.period_end
             group by 1, 2, 3) s$n$;
  if position('date_trunc(''month'', je.entry_date)::date as mon' in v_def) = 0 then
    if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'get_budget_vs_actuals: actuals block not found exactly once';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;

  -- 2. budget_worksheet_source (prior/current actuals)
  v_def := pg_get_functiondef('public.budget_worksheet_source(uuid, integer, text)'::regprocedure);
  v_old := $o$        select jl.gl_account_id as gid, public.fiscal_month_index(w.period_start, je.entry_date) as idx,
               sum(public.gl_normal_amount(ga.account_type::text, jl.debit_amount, jl.credit_amount)) as amt
          from public.journal_lines jl
          join public.journal_entries je on je.id = jl.entry_id and je.posted
          join public.gl_accounts ga on ga.id = jl.gl_account_id
         where jl.association_id = p_association_id
           and je.entry_date between w.period_start and w.period_end
           and public.gl_section(ga.account_type::text) in ('income', 'expense')
         group by 1, 2$o$;
  v_new := $n$        select s.gid, public.fiscal_month_index(w.period_start, s.mon) as idx,
               public.gl_normal_amount(s.account_type, s.d, s.c) as amt
          from (select jl.gl_account_id as gid, ga.account_type::text as account_type,
                       date_trunc('month', je.entry_date)::date as mon,
                       sum(jl.debit_amount) as d, sum(jl.credit_amount) as c
                  from public.journal_lines jl
                  join public.journal_entries je on je.id = jl.entry_id and je.posted
                  join public.gl_accounts ga on ga.id = jl.gl_account_id
                 where jl.association_id = p_association_id
                   and je.entry_date between w.period_start and w.period_end
                 group by 1, 2, 3) s
         where public.gl_section(s.account_type) in ('income', 'expense')$n$;
  if position('date_trunc(''month'', je.entry_date)::date as mon' in v_def) = 0 then
    if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'budget_worksheet_source: actuals block not found exactly once';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;

  -- 3. report_data_annual_budget_forecast (actual to date per budget line)
  v_def := pg_get_functiondef('public.report_data_annual_budget_forecast(uuid, jsonb)'::regprocedure);
  v_old := $o$        select sum(public.gl_normal_amount(l.account_type, jl.debit_amount, jl.credit_amount)) as amount$o$;
  v_new := $n$        select public.gl_normal_amount(l.account_type, sum(jl.debit_amount), sum(jl.credit_amount)) as amount$n$;
  if position(v_new in v_def) = 0 then
    if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'report_data_annual_budget_forecast: actual block not found exactly once';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;
end
$$;
