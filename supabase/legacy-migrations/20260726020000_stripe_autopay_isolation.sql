-- Make Stripe AutoPay enrollment and scheduled collection association-scoped
-- and safe under retries/concurrent cron invocations.

alter table public.payment_methods
  add column if not exists association_id uuid references public.associations(id);

-- A Stripe PaymentMethod is owned by exactly one connected account. Refuse to
-- guess if legacy data linked one method to mandates from multiple associations.
do $block$
begin
  if exists (
    select am.payment_method_id
    from public.autopay_mandates am
    where am.association_id is not null
    group by am.payment_method_id
    having count(distinct am.association_id) > 1
  ) then
    raise exception 'A payment method is linked to AutoPay mandates from multiple associations';
  end if;
end;
$block$;

update public.payment_methods pm
set association_id = scoped.association_id
from (
  select payment_method_id, min(association_id::text)::uuid as association_id
  from public.autopay_mandates
  where association_id is not null
  group by payment_method_id
) scoped
where scoped.payment_method_id = pm.id
  and pm.association_id is null;

create index if not exists payment_methods_association_owner_idx
  on public.payment_methods(association_id, owner_id)
  where association_id is not null;

alter table public.payment_methods
  drop constraint if exists payment_methods_stripe_scope_check;
alter table public.payment_methods
  add constraint payment_methods_stripe_scope_check
  check (
    processor::text <> 'stripe'
    or (
      association_id is not null
      and processor_account_id is not null
      and processor_account_id ~ '^acct_[A-Za-z0-9]+$'
    )
  ) not valid;

create table if not exists public.stripe_setup_attempts (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id),
  association_id uuid not null references public.associations(id),
  unit_id uuid not null references public.units(id),
  owner_id uuid not null references public.owners(id),
  created_by uuid references auth.users(id),
  processor_account_id text not null check (processor_account_id ~ '^acct_[A-Za-z0-9]+$'),
  processor_session_id text unique,
  processor_setup_intent_id text,
  mode text not null check (mode in ('fixed','current_balance','minimum','recurring_only','special_only')),
  day_of_month integer not null check (day_of_month between 1 and 28),
  authorized_amount_max_cents integer not null check (authorized_amount_max_cents between 100 and 5000000),
  fixed_amount_cents integer,
  minimum_amount_cents integer,
  include_late_fees boolean not null default true,
  terms_version text not null default 'autopay-v1',
  status text not null default 'pending'
    check (status in ('pending','session_created','completed','canceled','expired','failed')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text,
  check (fixed_amount_cents is null or fixed_amount_cents between 100 and authorized_amount_max_cents),
  check (minimum_amount_cents is null or minimum_amount_cents between 100 and authorized_amount_max_cents),
  check ((mode = 'fixed') = (fixed_amount_cents is not null)),
  check ((mode = 'minimum') = (minimum_amount_cents is not null))
);

create unique index if not exists stripe_setup_attempts_one_open_per_unit
  on public.stripe_setup_attempts(owner_id, unit_id)
  where status in ('pending','session_created');

create index if not exists stripe_setup_attempts_session_scope_idx
  on public.stripe_setup_attempts(processor_account_id, processor_session_id)
  where processor_session_id is not null;

alter table public.stripe_setup_attempts enable row level security;
revoke all on table public.stripe_setup_attempts from public, anon, authenticated;

create or replace function public.guard_stripe_setup_attempt_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_association public.associations%rowtype;
begin
  select * into v_association
  from public.associations
  where id = new.association_id;

  if not found
     or v_association.portfolio_id is distinct from new.portfolio_id
     or v_association.stripe_account_id is distinct from new.processor_account_id
     or not coalesce(v_association.stripe_charges_enabled, false)
     or not coalesce(v_association.stripe_payouts_enabled, false)
     or v_association.stripe_deauthorized_at is not null then
    raise exception 'AutoPay setup does not match a payment-ready association Stripe account';
  end if;

  if not exists (
    select 1
    from public.occupancies o
    where o.owner_id = new.owner_id
      and o.unit_id = new.unit_id
      and o.association_id = new.association_id
      and o.status = 'current'
  ) then
    raise exception 'AutoPay setup owner, unit, and association do not match a current occupancy';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists trg_guard_stripe_setup_attempt_scope on public.stripe_setup_attempts;
create trigger trg_guard_stripe_setup_attempt_scope
  before insert or update of portfolio_id, association_id, unit_id, owner_id, processor_account_id
  on public.stripe_setup_attempts
  for each row execute function public.guard_stripe_setup_attempt_scope();

create table if not exists public.stripe_autopay_runs (
  id uuid primary key default gen_random_uuid(),
  mandate_id uuid not null references public.autopay_mandates(id),
  scheduled_for date not null,
  processor_account_id text not null check (processor_account_id ~ '^acct_[A-Za-z0-9]+$'),
  idempotency_key text not null unique,
  status text not null default 'claimed'
    check (status in ('claimed','skipped','intent_created','submitted','failed','succeeded')),
  attempts integer not null default 1 check (attempts between 1 and 10),
  claimed_at timestamptz not null default now(),
  payment_intent_id uuid references public.payment_intents(id),
  processor_payment_intent_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (mandate_id, scheduled_for)
);

create index if not exists stripe_autopay_runs_processor_intent_idx
  on public.stripe_autopay_runs(processor_account_id, processor_payment_intent_id)
  where processor_payment_intent_id is not null;

alter table public.stripe_autopay_runs enable row level security;
revoke all on table public.stripe_autopay_runs from public, anon, authenticated;

create or replace function public.claim_stripe_autopay_run(
  p_mandate_id uuid,
  p_scheduled_for date
)
returns table(run_id uuid, idempotency_key text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_mandate public.autopay_mandates%rowtype;
  v_method public.payment_methods%rowtype;
  v_association public.associations%rowtype;
  v_run public.stripe_autopay_runs%rowtype;
  v_run_id uuid := gen_random_uuid();
begin
  select * into v_mandate
  from public.autopay_mandates
  where id = p_mandate_id
  for update;

  if not found
     or v_mandate.status::text <> 'active'
     or v_mandate.next_run_date is distinct from p_scheduled_for
     or p_scheduled_for > current_date then
    return;
  end if;

  select * into v_method from public.payment_methods where id = v_mandate.payment_method_id;
  select * into v_association from public.associations where id = v_mandate.association_id;

  if v_method.id is null
     or v_association.id is null
     or v_method.owner_id is distinct from v_mandate.owner_id
     or v_method.portfolio_id is distinct from v_mandate.portfolio_id
     or v_method.association_id is distinct from v_mandate.association_id
     or v_method.processor::text <> 'stripe'
     or v_method.processor_account_id is distinct from v_association.stripe_account_id
     or not coalesce(v_association.stripe_charges_enabled, false)
     or not coalesce(v_association.stripe_payouts_enabled, false)
     or v_association.stripe_deauthorized_at is not null then
    raise exception 'AutoPay mandate is not bound to a payment-ready association Stripe account';
  end if;

  insert into public.stripe_autopay_runs(
    id, mandate_id, scheduled_for, processor_account_id, idempotency_key
  ) values (
    v_run_id,
    p_mandate_id,
    p_scheduled_for,
    v_association.stripe_account_id,
    'autopay-run-' || v_run_id::text
  )
  on conflict (mandate_id, scheduled_for) do nothing
  returning * into v_run;

  if found then
    run_id := v_run.id;
    idempotency_key := v_run.idempotency_key;
    return next;
    return;
  end if;

  update public.stripe_autopay_runs
  set status = 'claimed',
      attempts = attempts + 1,
      claimed_at = now(),
      updated_at = now(),
      failure_reason = null
  where mandate_id = p_mandate_id
    and scheduled_for = p_scheduled_for
    and attempts < 3
    and (
      (status = 'claimed' and claimed_at < now() - interval '10 minutes')
      or (status = 'intent_created' and updated_at < now() - interval '10 minutes')
      or (status = 'failed' and processor_payment_intent_id is null)
    )
  returning * into v_run;

  if found then
    run_id := v_run.id;
    idempotency_key := v_run.idempotency_key;
    return next;
  end if;
end;
$function$;

revoke all on function public.claim_stripe_autopay_run(uuid, date) from public, anon, authenticated;
grant execute on function public.claim_stripe_autopay_run(uuid, date) to service_role;

create or replace function public.finalize_stripe_autopay_run(
  p_run_id uuid,
  p_processor_account_id text,
  p_processor_payment_intent_id text,
  p_payment_intent_id uuid,
  p_outcome text,
  p_failure_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_run public.stripe_autopay_runs%rowtype;
  v_mandate public.autopay_mandates%rowtype;
  v_next_run date;
begin
  if p_processor_account_id !~ '^acct_[A-Za-z0-9]+$'
     or p_outcome not in ('succeeded', 'failed')
     or (p_outcome = 'succeeded' and p_processor_payment_intent_id !~ '^pi_[A-Za-z0-9]+$')
     or (p_outcome = 'failed' and p_processor_payment_intent_id is not null
         and p_processor_payment_intent_id !~ '^pi_[A-Za-z0-9]+$') then
    raise exception 'Invalid Stripe AutoPay finalization identity';
  end if;

  select * into v_run
  from public.stripe_autopay_runs
  where id = p_run_id
  for update;
  if not found then raise exception 'Stripe AutoPay run not found'; end if;

  if v_run.processor_account_id is distinct from p_processor_account_id
     or (v_run.processor_payment_intent_id is not null
         and v_run.processor_payment_intent_id is distinct from p_processor_payment_intent_id)
     or (v_run.payment_intent_id is not null
         and v_run.payment_intent_id is distinct from p_payment_intent_id) then
    raise exception 'Stripe AutoPay run belongs to a different processor object';
  end if;

  select * into v_mandate
  from public.autopay_mandates
  where id = v_run.mandate_id
  for update;
  if not found then raise exception 'AutoPay mandate not found'; end if;

  v_next_run := (
    date_trunc('month', v_run.scheduled_for::timestamp)
    + interval '1 month'
    + (least(28, greatest(1, coalesce(v_mandate.day_of_month, 1))) - 1) * interval '1 day'
  )::date;

  if p_outcome = 'succeeded' then
    if v_run.status = 'succeeded' then return false; end if;
    if v_run.status = 'skipped' then
      raise exception 'A skipped AutoPay run cannot settle';
    end if;

    update public.stripe_autopay_runs
    set status = 'succeeded',
        processor_payment_intent_id = p_processor_payment_intent_id,
        payment_intent_id = p_payment_intent_id,
        failure_reason = null,
        completed_at = now(),
        updated_at = now()
    where id = v_run.id;

    update public.autopay_mandates
    set next_run_date = case when next_run_date = v_run.scheduled_for then v_next_run else next_run_date end,
        last_run_at = now(),
        success_count = coalesce(success_count, 0) + 1,
        failure_count = case
          when v_run.status = 'failed' then greatest(coalesce(failure_count, 0) - 1, 0)
          else coalesce(failure_count, 0)
        end,
        last_failure_reason = case when v_run.status = 'failed' then null else last_failure_reason end,
        updated_at = now()
    where id = v_mandate.id;
    return true;
  end if;

  if v_run.status in ('failed', 'succeeded') then return false; end if;
  if v_run.status = 'skipped' then
    raise exception 'A skipped AutoPay run cannot fail at Stripe';
  end if;

  update public.stripe_autopay_runs
  set status = 'failed',
      processor_payment_intent_id = coalesce(p_processor_payment_intent_id, processor_payment_intent_id),
      payment_intent_id = p_payment_intent_id,
      failure_reason = left(coalesce(p_failure_reason, 'Stripe payment failed'), 500),
      completed_at = now(),
      updated_at = now()
  where id = v_run.id;

  update public.autopay_mandates
  set next_run_date = case when next_run_date = v_run.scheduled_for then v_next_run else next_run_date end,
      last_run_at = now(),
      failure_count = coalesce(failure_count, 0) + 1,
      last_failure_at = now(),
      last_failure_reason = left(coalesce(p_failure_reason, 'Stripe payment failed'), 500),
      updated_at = now()
  where id = v_mandate.id;
  return true;
end;
$function$;

revoke all on function public.finalize_stripe_autopay_run(uuid, text, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_stripe_autopay_run(uuid, text, text, uuid, text, text)
  to service_role;

create or replace function public.guard_stripe_autopay_mandate_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_method public.payment_methods%rowtype;
  v_account_id text;
begin
  select * into v_method from public.payment_methods where id = new.payment_method_id;
  if v_method.processor::text <> 'stripe' then
    return new;
  end if;

  select stripe_account_id into v_account_id
  from public.associations
  where id = new.association_id
    and portfolio_id = new.portfolio_id;

  if v_method.owner_id is distinct from new.owner_id
     or v_method.portfolio_id is distinct from new.portfolio_id
     or v_method.association_id is distinct from new.association_id
     or v_method.processor_account_id is distinct from v_account_id then
    raise exception 'Stripe AutoPay mandate crosses owner, portfolio, association, or connected-account scope';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_stripe_autopay_mandate_scope on public.autopay_mandates;
create trigger trg_guard_stripe_autopay_mandate_scope
  before insert or update of portfolio_id, association_id, owner_id, payment_method_id
  on public.autopay_mandates
  for each row execute function public.guard_stripe_autopay_mandate_scope();

create unique index if not exists autopay_mandates_one_live_per_owner_unit
  on public.autopay_mandates(owner_id, unit_id)
  where unit_id is not null and status <> 'canceled';
