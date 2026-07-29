-- Fix infinite recursion: journal_entries board policy must NOT subquery
-- journal_lines (whose finance policy subqueries journal_entries). Scope by
-- the portfolio of the board's association(s) instead. Line-level amounts stay
-- association-scoped via journal_lines_board_read.
drop policy if exists journal_entries_board_read on public.journal_entries;
create policy journal_entries_board_read on public.journal_entries
  for select to authenticated
  using (
    public.is_board_user()
    and portfolio_id in (
      select a.portfolio_id from public.associations a
      where a.id in (select public.current_board_association_ids())
    )
  );;
