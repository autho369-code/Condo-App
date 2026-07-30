-- Phase 1: automation foundation + security advisor fixes
-- 1) Enable extensions needed for scheduling and outbound HTTP
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) Flip the 5 SECURITY DEFINER views to security_invoker so they respect the caller's RLS
alter view public.aged_receivables set (security_invoker = true);
alter view public.unit_balances set (security_invoker = true);
alter view public.monthly_income set (security_invoker = true);
alter view public.delinquent_units set (security_invoker = true);
alter view public.association_ownership_totals set (security_invoker = true);

-- 3) Pin search_path on the 4 trigger functions flagged by the advisor
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.touch_violation_updated()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.update_payment_intent_timestamp()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.update_work_order_timestamp()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 4) Lock down schema_migrations (infrastructure table; should not be reachable via PostgREST)
alter table public.schema_migrations enable row level security;
-- no policies = only service_role bypass can read/write it
;
