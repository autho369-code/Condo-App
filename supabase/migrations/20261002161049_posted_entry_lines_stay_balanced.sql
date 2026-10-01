-- validate_journal_entry_balance only runs on journal_entries (when an entry
-- is posted). journal_lines had no check, so lines of an already-posted entry
-- could be inserted, changed or deleted directly (finance RLS allows it) and
-- unbalance the ledger. A deferred constraint trigger re-checks, at commit,
-- every posted entry whose lines changed in the transaction.
create or replace function public.check_posted_entry_lines_balanced()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_entry uuid := coalesce(new.entry_id, old.entry_id);
  v_debit numeric;
  v_credit numeric;
begin
  if not exists (select 1 from public.journal_entries where id = v_entry and posted) then
    return null;
  end if;
  select coalesce(sum(debit_amount), 0), coalesce(sum(credit_amount), 0)
    into v_debit, v_credit
    from public.journal_lines where entry_id = v_entry;
  if abs(v_debit - v_credit) > 0.001 then
    raise exception 'Posted journal entry % would be unbalanced: debits=% credits=%', v_entry, v_debit, v_credit
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.entry_id is distinct from new.entry_id then
    select coalesce(sum(debit_amount), 0), coalesce(sum(credit_amount), 0)
      into v_debit, v_credit
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted
     where jl.entry_id = old.entry_id;
    if abs(v_debit - v_credit) > 0.001 then
      raise exception 'Posted journal entry % would be unbalanced: debits=% credits=%', old.entry_id, v_debit, v_credit
        using errcode = '23514';
    end if;
  end if;
  return null;
end;
$$;
revoke all on function public.check_posted_entry_lines_balanced() from public, anon, authenticated;

create constraint trigger journal_lines_posted_entry_balanced
  after insert or update or delete on public.journal_lines
  deferrable initially deferred
  for each row execute function public.check_posted_entry_lines_balanced();
