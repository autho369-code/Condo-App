-- Manually posting or deleting a draft journal entry from Journal Entries.
-- The app action authorized only through journal_entries RLS (portfolio
-- wide), so a manager limited to some associations could post or delete a
-- draft whose lines belong to another association. This function checks
-- finance access and that the caller may see every line's association, then
-- posts (the ledger's balance check still applies) or deletes the draft. A
-- bank-transfer draft (source_type 'bank_transfer') is linked to its transfer
-- when posted, so the transfer is no longer listed as incomplete.
create or replace function public.draft_journal_entry_action(p_entry_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_entry public.journal_entries;
begin
  if p_action not in ('post', 'delete') then
    raise exception 'Unknown action';
  end if;
  select * into v_entry from public.journal_entries where id = p_entry_id for update;
  if not found or not public.can_manage_finance(v_entry.portfolio_id) then
    raise exception 'That draft was not found';
  end if;
  if v_entry.posted then
    raise exception 'That entry is already posted';
  end if;
  if exists (
    select 1 from public.journal_lines jl
     where jl.entry_id = p_entry_id
       and not public.can_view_association_row(jl.association_id)
  ) then
    raise exception 'This draft includes an association you do not manage';
  end if;

  if p_action = 'post' then
    update public.journal_entries set posted = true where id = p_entry_id;
    if v_entry.source_type = 'bank_transfer' and v_entry.source_id is not null then
      update public.bank_transfers
         set journal_entry_id = p_entry_id
       where id = v_entry.source_id
         and journal_entry_id is null;
    end if;
  else
    delete from public.journal_entries where id = p_entry_id;
  end if;
end $$;

revoke all on function public.draft_journal_entry_action(uuid, text) from public, anon;
grant execute on function public.draft_journal_entry_action(uuid, text) to authenticated;
