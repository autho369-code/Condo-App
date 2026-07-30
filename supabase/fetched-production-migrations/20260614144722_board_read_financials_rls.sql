-- Board members are owners granted board permission; they may VIEW (read-only)
-- the financials of their OWN association(s). Scope via current_board_association_ids().

-- journal_lines: only lines belonging to the board's association(s)
drop policy if exists journal_lines_board_read on public.journal_lines;
create policy journal_lines_board_read on public.journal_lines
  for select to authenticated
  using (association_id in (select public.current_board_association_ids()));

-- journal_entries: readable if the entry has any line in the board's association(s)
drop policy if exists journal_entries_board_read on public.journal_entries;
create policy journal_entries_board_read on public.journal_entries
  for select to authenticated
  using (exists (
    select 1 from public.journal_lines jl
    where jl.entry_id = journal_entries.id
      and jl.association_id in (select public.current_board_association_ids())
  ));

-- bank_accounts: only accounts for the board's association(s)
drop policy if exists bank_accounts_board_read on public.bank_accounts;
create policy bank_accounts_board_read on public.bank_accounts
  for select to authenticated
  using (association_id in (select public.current_board_association_ids()));;
