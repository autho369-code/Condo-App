-- check_posted_entry_lines_balanced returned early when the line's NEW entry
-- was unposted, so moving a line off a posted entry (UPDATE of entry_id) left
-- the old posted entry unbalanced unchecked. Check each affected entry.
create or replace function public.check_posted_entry_lines_balanced()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_entry uuid;
  v_debit numeric;
  v_credit numeric;
begin
  foreach v_entry in array array_remove(array[
    case when tg_op <> 'DELETE' then new.entry_id end,
    case when tg_op <> 'INSERT' then old.entry_id end
  ], null) loop
    continue when not exists (select 1 from public.journal_entries where id = v_entry and posted);
    select coalesce(sum(debit_amount), 0), coalesce(sum(credit_amount), 0)
      into v_debit, v_credit
      from public.journal_lines where entry_id = v_entry;
    if abs(v_debit - v_credit) > 0.001 then
      raise exception 'Posted journal entry % would be unbalanced: debits=% credits=%', v_entry, v_debit, v_credit
        using errcode = '23514';
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function public.check_posted_entry_lines_balanced() from public, anon, authenticated;
