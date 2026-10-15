-- Indexes for the company column on two email tables (Supabase performance
-- advisor, unindexed_foreign_keys, 2026-10-14). Deleting a company and RLS
-- filters by portfolio_id no longer scan these tables. Additive only.
create index if not exists email_suppression_events_portfolio_idx
  on public.email_suppression_events (portfolio_id);
create index if not exists email_unsubscribe_links_portfolio_idx
  on public.email_unsubscribe_links (portfolio_id);
