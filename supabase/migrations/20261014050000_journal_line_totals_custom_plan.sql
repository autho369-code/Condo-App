-- Speed: journal_line_totals plans for the filters each call actually uses.
--
-- The function was a LANGUAGE sql body with "p_x is null or ..." filters.
-- It is not inlined (it sets search_path), so Postgres planned it once with
-- unknown parameters; under the caller's access rules that generic plan was
-- ~9x slower than the same query with the values known: at 2,000 units
-- (24,000 journal lines, rolled back) 875 ms for a manager vs 95 ms run
-- directly. Ledger totals feed the accounting pages, the command center,
-- metrics and every financial report. It is now plpgsql with
-- plan_cache_mode = force_custom_plan, so each call is planned with its own
-- values. Same signature, result, invoker rights (the caller's access rules
-- still apply), search_path and grants.

create or replace function public.journal_line_totals(
  p_portfolio_id uuid default null,
  p_gl_account_ids uuid[] default null,
  p_association_ids uuid[] default null,
  p_account_types text[] default null,
  p_from date default null,
  p_to date default null
)
returns table(gl_account_id uuid, account_type text, debit_total numeric, credit_total numeric)
language plpgsql
stable
set search_path = public
set plan_cache_mode = force_custom_plan
as $$
begin
  return query
  select jl.gl_account_id,
         ga.account_type::text,
         coalesce(sum(jl.debit_amount), 0)::numeric,
         coalesce(sum(jl.credit_amount), 0)::numeric
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id and je.posted
    join public.gl_accounts ga on ga.id = jl.gl_account_id
   where (p_portfolio_id is null or je.portfolio_id = p_portfolio_id)
     and (p_gl_account_ids is null or jl.gl_account_id = any (p_gl_account_ids))
     and (p_association_ids is null or jl.association_id = any (p_association_ids))
     and (p_account_types is null or ga.account_type::text = any (p_account_types))
     and (p_from is null or je.entry_date >= p_from)
     and (p_to is null or je.entry_date <= p_to)
   group by jl.gl_account_id, ga.account_type;
end
$$;
