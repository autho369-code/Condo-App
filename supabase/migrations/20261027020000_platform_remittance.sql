-- How management companies pay Portier369 (Mirsad, 2026-10-26: ACH bank
-- transfer). One row: the account companies send ACH payments to, entered by
-- the platform operator on /platform-operator/billing. The invoice email and
-- the company's Billing page show it (read server-side with the service key,
-- after the page or action has checked the caller).
--
-- Only the platform operator can read or change it through the API.

create table if not exists public.platform_remittance (
  id boolean primary key default true check (id),
  payee_name text not null check (length(btrim(payee_name)) between 1 and 200),
  bank_name text not null check (length(btrim(bank_name)) between 1 and 200),
  routing_number text not null check (routing_number ~ '^[0-9]{9}$'),
  account_number text not null check (account_number ~ '^[0-9]{4,17}$'),
  account_type text not null default 'checking' check (account_type in ('checking', 'savings')),
  instructions text check (instructions is null or length(instructions) <= 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.platform_remittance enable row level security;
revoke all on public.platform_remittance from anon;
drop policy if exists platform_remittance_operator_read on public.platform_remittance;
create policy platform_remittance_operator_read on public.platform_remittance
  for select to authenticated using ((select public.is_platform_operator()));
drop policy if exists platform_remittance_operator_insert on public.platform_remittance;
create policy platform_remittance_operator_insert on public.platform_remittance
  for insert to authenticated with check ((select public.is_platform_operator()));
drop policy if exists platform_remittance_operator_update on public.platform_remittance;
create policy platform_remittance_operator_update on public.platform_remittance
  for update to authenticated
  using ((select public.is_platform_operator()))
  with check ((select public.is_platform_operator()));
