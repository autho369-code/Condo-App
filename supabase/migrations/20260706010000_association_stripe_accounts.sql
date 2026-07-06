-- Per-association Stripe accounts (founder decision 2026-07-06):
-- each association has its OWN Stripe account -> own bank account -> own
-- financials. Implemented as Stripe Connect Standard connected accounts:
-- one platform API key, one Connect webhook endpoint, and direct charges on
-- the association's account so funds never touch the platform balance —
-- no commingling, clean audits, scales to thousands of associations.

alter table public.associations
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_onboarded_at timestamptz;

create unique index if not exists idx_associations_stripe_account
  on public.associations (stripe_account_id) where stripe_account_id is not null;
