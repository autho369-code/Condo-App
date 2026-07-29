-- =============================================================================
-- Phase 9c — API keys + outbound webhooks
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. api_keys (hashed, per-portfolio, optional scopes)
-- -----------------------------------------------------------------------------
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  prefix text not null,  -- first 8 chars of the key, shown in UI (e.g. "cak_abc1")
  key_hash text not null unique,  -- sha256 hex digest of the full key
  scopes text[] not null default '{}',
  description text,
  created_by uuid references auth.users(id) on delete set null,
  last_used_at timestamptz,
  last_used_ip text,
  use_count bigint not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_api_keys_portfolio_active on public.api_keys(portfolio_id) where revoked_at is null;
create index idx_api_keys_hash on public.api_keys(key_hash);
create index idx_api_keys_prefix on public.api_keys(prefix);
create index idx_api_keys_expires on public.api_keys(expires_at) where revoked_at is null and expires_at is not null;
create trigger trg_api_keys_updated before update on public.api_keys
  for each row execute function public.touch_updated_at();

alter table public.api_keys enable row level security;
create policy api_keys_platform_all on public.api_keys
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());
create policy api_keys_admin_all on public.api_keys
  for all to authenticated
  using (public.can_admin_portfolio(portfolio_id))
  with check (public.can_admin_portfolio(portfolio_id) and public.has_entitlement(portfolio_id, 'api_keys'));

comment on table public.api_keys is 'Portfolio-scoped API keys. Stored as SHA-256 hash; the raw key is shown only once at creation and never again.';
comment on column public.api_keys.prefix is 'First chars of the key (e.g. cak_abc1...) — safe to show in UIs for identification.';
comment on column public.api_keys.scopes is 'Array of permission strings (e.g. read:work_orders, write:charges). Empty = full portfolio access.';

-- -----------------------------------------------------------------------------
-- 2. Helper: verify an API key and return the portfolio + scopes
--    Used by edge functions / API gateways.
-- -----------------------------------------------------------------------------
create or replace function public.verify_api_key(p_raw_key text)
returns table(portfolio_id uuid, key_id uuid, scopes text[])
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  k_hash text;
  k_row public.api_keys;
begin
  if p_raw_key is null or length(p_raw_key) < 16 then
    return;
  end if;

  k_hash := encode(extensions.digest(p_raw_key, 'sha256'), 'hex');

  select * into k_row
    from public.api_keys
   where key_hash = k_hash
     and revoked_at is null
     and (expires_at is null or expires_at > now())
   limit 1;

  if not found then
    return;
  end if;

  -- Update last_used stats (don't block verification if this fails)
  update public.api_keys
     set last_used_at = now(), use_count = use_count + 1
   where id = k_row.id;

  portfolio_id := k_row.portfolio_id;
  key_id := k_row.id;
  scopes := k_row.scopes;
  return next;
end;
$$;

grant execute on function public.verify_api_key(text) to service_role, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Helper: create an API key
--    Generates a key, hashes it, stores the hash, returns the raw key ONCE.
-- -----------------------------------------------------------------------------
create or replace function public.create_api_key(
  p_portfolio_id uuid,
  p_name text,
  p_scopes text[] default '{}',
  p_expires_days integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  raw_key text;
  key_prefix text;
  k_hash text;
  new_id uuid;
begin
  -- Generates a 48-char hex key prefixed with cak_ (Condo App Key)
  raw_key := 'cak_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  key_prefix := substring(raw_key from 1 for 12);
  k_hash := encode(extensions.digest(raw_key, 'sha256'), 'hex');

  insert into public.api_keys (
    portfolio_id, name, prefix, key_hash, scopes, created_by, expires_at
  ) values (
    p_portfolio_id, p_name, key_prefix, k_hash, coalesce(p_scopes, '{}'),
    auth.uid(),
    case when p_expires_days is not null then now() + make_interval(days => p_expires_days) end
  ) returning id into new_id;

  return jsonb_build_object(
    'id', new_id,
    'api_key', raw_key,
    'prefix', key_prefix,
    'warning', 'Store this key securely — it will not be shown again.'
  );
end;
$$;

grant execute on function public.create_api_key(uuid, text, text[], integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Webhook endpoints
-- -----------------------------------------------------------------------------
create type public.webhook_event as enum (
  'charge.created', 'charge.updated', 'charge.voided',
  'payment.received', 'payment.failed', 'payment.refunded',
  'work_order.created', 'work_order.status_changed', 'work_order.completed',
  'service_request.created', 'service_request.resolved',
  'bill.created', 'bill.approved', 'bill.paid',
  'violation.created', 'violation.resolved',
  'notice.sent', 'statement.generated',
  'owner.created', 'owner.updated',
  'inspection.completed'
);

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  url text not null check (url ~ '^https?://'),
  signing_secret text not null default (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  events public.webhook_event[] not null default '{}',
  active boolean not null default true,
  failure_count integer not null default 0,
  disabled_until timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_failure_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_webhook_endpoints_portfolio on public.webhook_endpoints(portfolio_id) where active;
create index idx_webhook_endpoints_events on public.webhook_endpoints using gin (events);
create trigger trg_webhook_endpoints_updated before update on public.webhook_endpoints
  for each row execute function public.touch_updated_at();

alter table public.webhook_endpoints enable row level security;
create policy webhook_endpoints_platform_all on public.webhook_endpoints
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());
create policy webhook_endpoints_admin_all on public.webhook_endpoints
  for all to authenticated
  using (public.can_admin_portfolio(portfolio_id))
  with check (public.can_admin_portfolio(portfolio_id) and public.has_entitlement(portfolio_id, 'webhooks'));

comment on table public.webhook_endpoints is 'Portfolio-scoped outbound webhook URLs. signing_secret is used for HMAC-SHA256 signatures. After 10 consecutive failures, auto-disabled_until is set.';

-- -----------------------------------------------------------------------------
-- 5. Webhook deliveries (attempt log)
-- -----------------------------------------------------------------------------
create type public.webhook_delivery_status as enum ('pending', 'succeeded', 'failed', 'retrying', 'abandoned');

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_type public.webhook_event not null,
  payload jsonb not null,
  status public.webhook_delivery_status not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  succeeded_at timestamptz,
  response_code integer,
  response_body text,
  error_message text,
  signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_webhook_deliveries_endpoint on public.webhook_deliveries(endpoint_id, created_at desc);
create index idx_webhook_deliveries_pending on public.webhook_deliveries(next_attempt_at)
  where status in ('pending','retrying');
create index idx_webhook_deliveries_status on public.webhook_deliveries(status, created_at desc);
create trigger trg_webhook_deliveries_updated before update on public.webhook_deliveries
  for each row execute function public.touch_updated_at();

alter table public.webhook_deliveries enable row level security;
create policy webhook_deliveries_platform_all on public.webhook_deliveries
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());
create policy webhook_deliveries_admin_read on public.webhook_deliveries
  for select to authenticated
  using (exists (
    select 1 from public.webhook_endpoints we
    where we.id = endpoint_id and public.can_admin_portfolio(we.portfolio_id)
  ));

-- -----------------------------------------------------------------------------
-- 6. Dispatch helper: queue a webhook for every matching endpoint on an event
-- -----------------------------------------------------------------------------
create or replace function public.dispatch_webhook(
  p_portfolio_id uuid,
  p_event public.webhook_event,
  p_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  queued_count integer := 0;
  endpoint_row public.webhook_endpoints;
begin
  if not public.has_entitlement(p_portfolio_id, 'webhooks') then
    return 0;
  end if;

  for endpoint_row in
    select * from public.webhook_endpoints
     where portfolio_id = p_portfolio_id
       and active
       and (disabled_until is null or disabled_until < now())
       and p_event = any(events)
  loop
    insert into public.webhook_deliveries (endpoint_id, event_type, payload)
    values (endpoint_row.id, p_event, p_payload);
    queued_count := queued_count + 1;
  end loop;
  return queued_count;
end;
$$;

grant execute on function public.dispatch_webhook(uuid, public.webhook_event, jsonb) to service_role, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Mark delivery outcome (called by the webhook-sender edge function)
-- -----------------------------------------------------------------------------
create or replace function public.mark_webhook_delivery(
  p_delivery_id uuid,
  p_success boolean,
  p_response_code integer default null,
  p_response_body text default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  d public.webhook_deliveries;
  ep public.webhook_endpoints;
  retry_delay_seconds integer;
begin
  select * into d from public.webhook_deliveries where id = p_delivery_id for update;
  if not found then return; end if;

  select * into ep from public.webhook_endpoints where id = d.endpoint_id for update;

  if p_success then
    update public.webhook_deliveries
       set status = 'succeeded',
           attempts = attempts + 1,
           last_attempt_at = now(),
           succeeded_at = now(),
           response_code = p_response_code,
           response_body = left(coalesce(p_response_body, ''), 4000),
           error_message = null
     where id = p_delivery_id;

    update public.webhook_endpoints
       set failure_count = 0,
           last_success_at = now(),
           disabled_until = null
     where id = d.endpoint_id;
  else
    -- Exponential backoff: 1m, 5m, 25m, 2h, capped; abandon after 8 attempts
    retry_delay_seconds := least(power(5, d.attempts)::integer * 60, 7200);

    update public.webhook_deliveries
       set attempts = attempts + 1,
           last_attempt_at = now(),
           response_code = p_response_code,
           response_body = left(coalesce(p_response_body, ''), 4000),
           error_message = left(coalesce(p_error_message, ''), 1000),
           status = case when attempts + 1 >= 8 then 'abandoned'::public.webhook_delivery_status
                         else 'retrying'::public.webhook_delivery_status end,
           next_attempt_at = now() + make_interval(secs => retry_delay_seconds)
     where id = p_delivery_id;

    update public.webhook_endpoints
       set failure_count = failure_count + 1,
           last_failure_at = now(),
           last_failure_message = left(coalesce(p_error_message, ''), 500),
           -- Auto-disable endpoint for 1 hour after 10 consecutive failures
           disabled_until = case when failure_count + 1 >= 10 then now() + interval '1 hour' else disabled_until end
     where id = d.endpoint_id;
  end if;
end;
$$;

grant execute on function public.mark_webhook_delivery(uuid, boolean, integer, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- 8. Purge old webhook deliveries (30 days), purge expired API keys (abandoned)
-- -----------------------------------------------------------------------------
select cron.schedule(
  'purge-old-webhook-deliveries',
  '23 3 * * *',
  $$ delete from public.webhook_deliveries
      where status in ('succeeded','abandoned')
        and created_at < now() - interval '30 days'; $$
);

select cron.schedule(
  'auto-revoke-expired-api-keys',
  '5 3 * * *',
  $$ update public.api_keys
        set revoked_at = now(), updated_at = now()
      where revoked_at is null
        and expires_at is not null
        and expires_at < now(); $$
);
;
