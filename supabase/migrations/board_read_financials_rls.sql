-- Board members are owners granted board permission. They may VIEW (read-only)
-- the financials of their OWN association(s) — scoped via current_board_association_ids().
-- Previously only can_manage_finance() (finance staff) / platform operators could
-- read journal_lines / journal_entries / bank_accounts, so the board portal's
-- Financials page rendered all $0 for board users.
--
-- NOTE: journal_entries has no association_id, so its board policy scopes by the
-- PORTFOLIO of the board's association(s). It must NOT subquery journal_lines —
-- journal_lines' finance policy subqueries journal_entries, which would create
-- infinite recursion. Line-level amounts stay association-scoped via
-- journal_lines_board_read.

-- journal_lines: only lines belonging to the board's association(s)
drop policy if exists journal_lines_board_read on public.journal_lines;
create policy journal_lines_board_read on public.journal_lines
  for select to authenticated
  using (association_id in (select public.current_board_association_ids()));

-- journal_entries: scoped by the portfolio of the board's association(s)
drop policy if exists journal_entries_board_read on public.journal_entries;
create policy journal_entries_board_read on public.journal_entries
  for select to authenticated
  using (
    public.is_board_user()
    and portfolio_id in (
      select a.portfolio_id from public.associations a
      where a.id in (select public.current_board_association_ids())
    )
  );

-- bank_accounts: only accounts for the board's association(s)
drop policy if exists bank_accounts_board_read on public.bank_accounts;
create policy bank_accounts_board_read on public.bank_accounts
  for select to authenticated
  using (association_id in (select public.current_board_association_ids()));
