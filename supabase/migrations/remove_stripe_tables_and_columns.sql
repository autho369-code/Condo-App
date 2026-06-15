-- Stripe removed once and for all (offline/manual remittance only). All Stripe
-- tables + columns were verified empty (0 rows) before dropping.
-- Applied to remote DB 2026-06-14.

drop table if exists public.stripe_customers cascade;
drop table if exists public.stripe_payments cascade;
drop table if exists public.stripe_subscriptions cascade;
drop table if exists public.stripe_webhook_events cascade;

-- payment_intents (old Stripe checkout intents): remove its only inbound FK
-- column first, then drop the table.
alter table public.autopay_mandates drop column if exists last_run_payment_intent_id;
drop table if exists public.payment_intents cascade;

-- Stripe columns on surviving tables.
alter table public.invoices drop column if exists stripe_invoice_id;
alter table public.invoices drop column if exists stripe_invoice_url;
alter table public.subscriptions drop column if exists stripe_customer_id;
alter table public.subscriptions drop column if exists stripe_subscription_id;
alter table public.subscription_events drop column if exists stripe_event_id;

-- Note: the `payment_processor` enum still lists 'stripe' as a value alongside
-- 'dwolla'/'modern_treasury'. Nothing references it; dropping an enum value
-- requires recreating the type and retyping every dependent column, so it is
-- left as inert metadata.
