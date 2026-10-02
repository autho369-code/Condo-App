-- Financial Diagnostics (AppFolio parity): per-association GL balances and
-- the offsetting side of escrow cash postings. Runs as the caller (RLS).

create or replace function public.gl_balances_by_association(p_gl_account_ids uuid[])
returns table(association_id uuid, gl_account_id uuid, debit_minus_credit numeric)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public'
as $$
  select jl.association_id, jl.gl_account_id, sum(jl.debit_amount - jl.credit_amount)
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id and je.posted
   where jl.gl_account_id = any (p_gl_account_ids)
   group by jl.association_id, jl.gl_account_id;
$$;

-- Credit-minus-debit total of every other line on entries that post to the
-- given escrow cash accounts, per association ("All GL accounts with escrow
-- cash offset").
create or replace function public.escrow_offset_by_association(p_escrow_gl_ids uuid[])
returns table(association_id uuid, offset_balance numeric)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public'
as $$
  select jl.association_id, sum(jl.credit_amount - jl.debit_amount)
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id and je.posted
   where not (jl.gl_account_id = any (p_escrow_gl_ids))
     and exists (select 1 from public.journal_lines e
                  where e.entry_id = jl.entry_id and e.gl_account_id = any (p_escrow_gl_ids))
   group by jl.association_id;
$$;

revoke all on function public.gl_balances_by_association(uuid[]) from public, anon;
revoke all on function public.escrow_offset_by_association(uuid[]) from public, anon;
grant execute on function public.gl_balances_by_association(uuid[]) to authenticated, service_role;
grant execute on function public.escrow_offset_by_association(uuid[]) to authenticated, service_role;
