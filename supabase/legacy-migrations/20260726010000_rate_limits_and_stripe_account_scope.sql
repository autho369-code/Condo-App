-- Durable public-endpoint throttling and strict Stripe Connect account scope.

create table if not exists public.api_rate_limits (
  scope text not null,
  key_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (scope, key_hash, window_start)
);

revoke all on table public.api_rate_limits from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_key_hash text,
  p_window_seconds integer,
  p_max_requests integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_scope !~ '^[a-z0-9:_-]{1,80}$'
     or p_key_hash !~ '^[a-f0-9]{64}$'
     or p_window_seconds not between 1 and 86400
     or p_max_requests not between 1 and 10000 then
    raise exception 'Invalid rate-limit parameters';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits(scope, key_hash, window_start, request_count)
  values (p_scope, p_key_hash, v_window_start, 1)
  on conflict (scope, key_hash, window_start)
  do update set request_count = api_rate_limits.request_count + 1
  returning request_count into v_count;

  allowed := v_count <= p_max_requests;
  remaining := greatest(0, p_max_requests - v_count);
  reset_at := v_window_start + make_interval(secs => p_window_seconds);
  return next;
end;
$function$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;

alter table public.payment_intents
  add column if not exists processor_account_id text,
  add column if not exists processor_livemode boolean,
  add column if not exists idempotency_key text;
alter table public.payment_methods
  add column if not exists processor_account_id text;
alter table public.associations
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_disabled_reason text,
  add column if not exists stripe_last_status_at timestamptz,
  add column if not exists stripe_deauthorized_at timestamptz,
  add column if not exists stripe_settlement_bank_account_id uuid references public.bank_accounts(id);
alter table public.payout_batches
  add column if not exists processor_account_id text,
  add column if not exists settlement_bank_account_id uuid references public.bank_accounts(id);
alter table public.payments
  add column if not exists processor text,
  add column if not exists processor_account_id text,
  add column if not exists processor_payment_intent_id text;

update public.payment_intents pi
set processor_account_id = a.stripe_account_id
from public.associations a
where a.id = pi.association_id
  and pi.processor_account_id is null
  and a.stripe_account_id is not null;

update public.payment_methods pm
set processor_account_id = a.stripe_account_id
from public.autopay_mandates am
join public.associations a on a.id = am.association_id
where am.payment_method_id = pm.id
  and pm.processor = 'stripe'
  and pm.processor_account_id is null
  and a.stripe_account_id is not null;

update public.payments p
set processor = 'stripe',
    processor_account_id = pi.processor_account_id,
    processor_payment_intent_id = pi.processor_payment_intent_id
from public.payment_intents pi
where pi.payment_id = p.id
  and pi.processor_payment_intent_id is not null
  and p.processor_payment_intent_id is null;

create unique index if not exists payment_intents_processor_account_idx
  on public.payment_intents(processor_account_id, processor_payment_intent_id)
  where processor_account_id is not null and processor_payment_intent_id is not null;

create unique index if not exists payment_intents_idempotency_key_unique
  on public.payment_intents(idempotency_key)
  where idempotency_key is not null;

create unique index if not exists payment_methods_stripe_account_token_unique
  on public.payment_methods(processor_account_id, processor_token)
  where processor = 'stripe' and processor_account_id is not null;

create unique index if not exists payments_stripe_processor_identity_unique
  on public.payments(processor, processor_account_id, processor_payment_intent_id)
  where processor = 'stripe'
    and processor_account_id is not null
    and processor_payment_intent_id is not null;

drop index if exists public.payments_stripe_reference_unique;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  processor_account_id text,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing', 'processed', 'failed')),
  attempts integer not null default 1,
  claimed_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

revoke all on table public.stripe_webhook_events from public, anon, authenticated;

create table if not exists public.payment_processor_adjustments (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  payment_intent_id uuid not null references public.payment_intents(id),
  processor_account_id text not null,
  adjustment_type text not null check (adjustment_type in ('refund', 'dispute', 'ach_return')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'usd',
  reason text,
  review_status text not null default 'pending_review'
    check (review_status in ('pending_review', 'approved', 'posted', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

revoke all on table public.payment_processor_adjustments from public, anon, authenticated;

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_processor_account_id text,
  p_event_type text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_claimed boolean := false;
begin
  if p_event_id !~ '^evt_[A-Za-z0-9_]+$'
     or length(p_event_type) not between 1 and 120
     or (p_processor_account_id is not null and p_processor_account_id !~ '^acct_[A-Za-z0-9]+$') then
    raise exception 'Invalid Stripe event identity';
  end if;

  insert into public.stripe_webhook_events(event_id, processor_account_id, event_type)
  values (p_event_id, p_processor_account_id, p_event_type)
  on conflict (event_id) do nothing;
  if found then
    return true;
  end if;

  update public.stripe_webhook_events
  set status = 'processing',
      attempts = attempts + 1,
      claimed_at = now(),
      last_error = null
  where event_id = p_event_id
    and processor_account_id is not distinct from p_processor_account_id
    and event_type = p_event_type
    and (status = 'failed' or (status = 'processing' and claimed_at < now() - interval '5 minutes'))
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$function$;

revoke all on function public.claim_stripe_webhook_event(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text, text) to service_role;

create or replace function public.post_stripe_ledger_payment(
  p_intent_id uuid,
  p_method text,
  p_processor_payment_intent_id text,
  p_processor_account_id text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_intent public.payment_intents%rowtype;
  v_association_account_id text;
  v_payment_id uuid;
begin
  if p_method not in ('card', 'ach') then
    raise exception 'Unsupported Stripe payment method';
  end if;
  if p_processor_payment_intent_id !~ '^pi_[A-Za-z0-9_]+$'
     or p_processor_account_id !~ '^acct_[A-Za-z0-9]+$' then
    raise exception 'Invalid Stripe processor identity';
  end if;

  select * into v_intent
  from public.payment_intents
  where id = p_intent_id
  for update;
  if not found then raise exception 'Payment intent not found'; end if;

  select stripe_account_id into v_association_account_id
  from public.associations
  where id = v_intent.association_id;

  if v_association_account_id is distinct from p_processor_account_id
     or (v_intent.processor_account_id is not null
         and v_intent.processor_account_id is distinct from p_processor_account_id) then
    raise exception 'Stripe account does not match payment association';
  end if;
  if lower(v_intent.currency) <> 'usd' then
    raise exception 'Unsupported payment intent currency';
  end if;
  if v_intent.processor_payment_intent_id is not null
     and v_intent.processor_payment_intent_id is distinct from p_processor_payment_intent_id then
    raise exception 'Payment intent is already bound to a different Stripe PaymentIntent';
  end if;
  if v_intent.payment_id is not null then
    return v_intent.payment_id;
  end if;

  insert into public.payments(
    unit_id,
    amount,
    payment_date,
    method,
    reference,
    notes,
    processor,
    processor_account_id,
    processor_payment_intent_id
  )
  values (
    v_intent.unit_id,
    v_intent.amount,
    current_date,
    p_method,
    p_processor_payment_intent_id,
    format('Online payment via Stripe Connect (%s)', p_method),
    'stripe',
    p_processor_account_id,
    p_processor_payment_intent_id
  )
  on conflict (processor, processor_account_id, processor_payment_intent_id)
    where processor = 'stripe'
      and processor_account_id is not null
      and processor_payment_intent_id is not null
  do nothing
  returning id into v_payment_id;

  if v_payment_id is null then
    select id into v_payment_id from public.payments
    where processor = 'stripe'
      and processor_account_id = p_processor_account_id
      and processor_payment_intent_id = p_processor_payment_intent_id
      and unit_id = v_intent.unit_id
      and amount = v_intent.amount;
  end if;
  if v_payment_id is null then raise exception 'Could not resolve Stripe ledger payment'; end if;

  update public.payment_intents
  set payment_id = v_payment_id,
      processor_account_id = p_processor_account_id,
      processor_payment_intent_id = p_processor_payment_intent_id,
      processor = 'stripe',
      method = p_method,
      status = 'succeeded',
      succeeded_at = coalesce(succeeded_at, now()),
      updated_at = now()
  where id = v_intent.id;

  return v_payment_id;
end;
$function$;

revoke all on function public.post_stripe_ledger_payment(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.post_stripe_ledger_payment(uuid, text, text, text) to service_role;

-- The legacy overload cannot prove which association-owned Stripe account
-- emitted an event. Remove it so no caller can bypass connected-account scope.
drop function if exists public.post_stripe_ledger_payment(uuid, text, text);
