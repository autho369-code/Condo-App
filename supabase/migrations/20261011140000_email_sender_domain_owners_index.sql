-- email_sender_domain_owners: index its company column.
--
-- The Supabase performance advisor flagged portfolio_id as the only foreign
-- key without an index: deleting a company (on delete cascade) or listing a
-- company's sending domains scans the table. (Its policy already checks the
-- platform-admin rule once per query, since 20261011010000.)
-- Additive only: nothing is dropped or deleted.

create index if not exists email_sender_domain_owners_portfolio_id_idx
  on public.email_sender_domain_owners (portfolio_id);
