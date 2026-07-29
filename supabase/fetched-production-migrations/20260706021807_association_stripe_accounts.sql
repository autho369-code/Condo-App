-- See supabase/migrations/20260706010000_association_stripe_accounts.sql
alter table public.associations
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_onboarded_at timestamptz;

create unique index if not exists idx_associations_stripe_account
  on public.associations (stripe_account_id) where stripe_account_id is not null;;
