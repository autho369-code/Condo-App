-- Security: board members could read EVERY journal entry of the management
-- company (memos, descriptions, references of other associations), because
-- the policy matched on portfolio_id. They now see only entries that post at
-- least one line to an association they serve on — the lines themselves were
-- already association-scoped. (A definer helper avoids policy recursion:
-- journal_lines' own policies reference journal_entries.)
create or replace function public.journal_entry_touches_board_associations(p_entry uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.journal_lines jl
     where jl.entry_id = p_entry
       and jl.association_id in (select public.current_board_association_ids()));
$$;
revoke all on function public.journal_entry_touches_board_associations(uuid) from public, anon;
grant execute on function public.journal_entry_touches_board_associations(uuid) to authenticated;

drop policy if exists journal_entries_board_read on public.journal_entries;
create policy journal_entries_board_read on public.journal_entries for select to authenticated
  using (public.is_board_user() and public.journal_entry_touches_board_associations(id));
