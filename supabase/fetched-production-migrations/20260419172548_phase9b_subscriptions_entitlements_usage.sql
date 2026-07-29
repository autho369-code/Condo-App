-- =============================================================================
-- Phase 9b — Subscriptions, entitlements, usage metering
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Entitlements catalog (feature flags available on each tier)
-- -----------------------------------------------------------------------------
create table public.feature_entitlements (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (length(key) between 1 and 100),
  name text not null,
  description text,
  min_tier public.portfolio_tier not null default 'core',
  category text not null default 'general',
  created_at timestamptz not null default now()
);

alter table public.feature_entitlements enable row level security;
create policy feature_entitlements_read on public.feature_entitlements
  for select to authenticated using (true);
create policy feature_entitlements_platform_write on public.feature_entitlements
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());

-- Seed catalog
insert into public.feature_entitlements (key, name, description, min_tier, category) values
  ('vendor_portal',          'Vendor Portal',               'External vendor login + work order access',          'plus',   'portal'),
  ('homeowner_portal',       'Homeowner Portal',            'Self-service portal for homeowners',                 'core',   'portal'),
  ('custom_roles',           'Custom User Roles',           'Create roles beyond the 6 system defaults',          'plus',   'admin'),
  ('api_keys',               'API Access',                  'Create API keys for integrations',                   'plus',   'integrations'),
  ('webhooks',               'Outbound Webhooks',           'Configure webhook endpoints for events',             'plus',   'integrations'),
  ('sms_inbox',              'SMS / Texting',               'Dedicated texting number + inbound/outbound SMS',    'plus',   'comms'),
  ('scheduled_reports',      'Scheduled Reports',           'Recurring report generation + delivery',             'plus',   'reporting'),
  ('stripe_payments',        'Online Payments',             'Collect ACH/card payments from homeowners',          'core',   'payments'),
  ('multi_bank_accounts',    'Multiple Bank Accounts',      'Manage more than one bank account per portfolio',    'plus',   'finance'),
  ('approval_workflows',     'Bill Approval Workflows',     'Multi-step bill approval with thresholds',           'plus',   'finance'),
  ('fixed_assets',           'Fixed Asset Tracking',        'Depreciation schedules + asset register',            'plus',   'finance'),
  ('inspections',            'Inspections',                 'Scheduled inspections with findings + photos',       'plus',   'operations'),
  ('advanced_permissions',   'GL Account Permissions',      'Per-role per-GL-account access control',             'max',    'admin'),
  ('audit_log_long_retention','Extended Audit Retention',   '7-year audit log retention (default 90 days)',       'max',    'compliance'),
  ('data_export',            'Data Export',                 'Full portfolio data export (JSON / CSV)',            'max',    'compliance'),
  ('sso',                    'SSO / SAML',                  'Single sign-on via SAML / OIDC',                     'max',    'security'),
  ('platform_branding',      'Custom Branding',             'Custom logo + domain for portal',                    'max',    'branding'),
  ('unlimited_associations', 'Unlimited Associations',      'No cap on number of HOAs managed',                   'max',    'limits');

comment on table public.feature_entitlements is 'Catalog of features available per subscription tier. Used to gate functionality in the UI and API.';

-- -----------------------------------------------------------------------------
-- 2. subscriptions — one per portfolio
-- -----------------------------------------------------------------------------
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'paused', 'expired'
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null unique references public.portfolios(id) on delete cascade,
  tier public.portfolio_tier not null default 'core',
  status public.subscription_status not null default 'trialing',
  seats_included integer not null default 5 check (seats_included >= 1),
  seats_used integer not null default 0 check (seats_used >= 0),
  associations_limit integer check (associations_limit is null or associations_limit >= 1),
  units_limit integer check (units_limit is null or units_limit >= 1),
  billing_email text,
  stripe_customer_id text,
  stripe_subscription_id text,
  price_monthly_cents integer,
  price_per_seat_cents integer,
  currency text not null default 'usd',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_subscriptions_status on public.subscriptions(status) where status in ('past_due','trialing');
create index idx_subscriptions_stripe_customer on public.subscriptions(stripe_customer_id);
create index idx_subscriptions_stripe_sub on public.subscriptions(stripe_subscription_id);
create index idx_subscriptions_trial_ends on public.subscriptions(trial_ends_at) where status = 'trialing';
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.touch_updated_at();

alter table public.subscriptions enable row level security;
create policy subscriptions_platform_all on public.subscriptions
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());
create policy subscriptions_admin_read on public.subscriptions
  for select to authenticated
  using (public.can_admin_portfolio(portfolio_id));

comment on table public.subscriptions is 'One subscription per portfolio. Platform operators write; portfolio admins read-only.';

-- -----------------------------------------------------------------------------
-- 3. subscription_events — audit log of tier changes
-- -----------------------------------------------------------------------------
create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  event_type text not null,
  from_tier public.portfolio_tier,
  to_tier public.portfolio_tier,
  from_status public.subscription_status,
  to_status public.subscription_status,
  actor_user_id uuid references auth.users(id) on delete set null,
  stripe_event_id text,
  payload jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index idx_sub_events_subscription on public.subscription_events(subscription_id, at desc);
create index idx_sub_events_portfolio on public.subscription_events(portfolio_id, at desc);
create index idx_sub_events_stripe on public.subscription_events(stripe_event_id);

alter table public.subscription_events enable row level security;
create policy sub_events_platform_all on public.subscription_events
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());
create policy sub_events_admin_read on public.subscription_events
  for select to authenticated
  using (public.can_admin_portfolio(portfolio_id));

-- Trigger: log every subscription change
create or replace function public.log_subscription_change()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.subscription_events (subscription_id, portfolio_id, event_type, to_tier, to_status, actor_user_id, payload)
    values (new.id, new.portfolio_id, 'created', new.tier, new.status, auth.uid(), to_jsonb(new));
  elsif tg_op = 'UPDATE' and (new.tier is distinct from old.tier or new.status is distinct from old.status) then
    insert into public.subscription_events (
      subscription_id, portfolio_id, event_type, from_tier, to_tier, from_status, to_status, actor_user_id, payload
    ) values (
      new.id, new.portfolio_id,
      case
        when new.tier <> old.tier and new.tier > old.tier then 'upgrade'
        when new.tier <> old.tier and new.tier < old.tier then 'downgrade'
        when new.status <> old.status then 'status_change'
        else 'update'
      end,
      old.tier, new.tier, old.status, new.status, auth.uid(),
      jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_subscription on public.subscriptions;
create trigger trg_log_subscription
  after insert or update on public.subscriptions
  for each row execute function public.log_subscription_change();

-- -----------------------------------------------------------------------------
-- 4. Sync portfolios.tier with subscriptions.tier
-- -----------------------------------------------------------------------------
create or replace function public.sync_portfolio_tier_from_subscription()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  update public.portfolios set tier = new.tier, updated_at = now()
   where id = new.portfolio_id and tier is distinct from new.tier;
  return new;
end;
$$;

drop trigger if exists trg_sync_portfolio_tier on public.subscriptions;
create trigger trg_sync_portfolio_tier
  after insert or update of tier on public.subscriptions
  for each row execute function public.sync_portfolio_tier_from_subscription();

-- -----------------------------------------------------------------------------
-- 5. Seat-limit enforcement on profile portfolio assignment
-- -----------------------------------------------------------------------------
create or replace function public.check_seat_limit()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  sub public.subscriptions;
  current_staff_count integer;
begin
  if new.portfolio_id is null or new.hoa_role <> 'manager' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.portfolio_id = new.portfolio_id and old.hoa_role = 'manager' then
    return new;  -- no-op for this table
  end if;

  select * into sub from public.subscriptions where portfolio_id = new.portfolio_id;
  if not found then
    return new;  -- no subscription = no limit enforced
  end if;

  select count(*) into current_staff_count
    from public.profiles
   where portfolio_id = new.portfolio_id and hoa_role = 'manager';

  if current_staff_count >= sub.seats_included then
    raise exception 'portfolio % has reached its seat limit (% of %). Upgrade to add more staff.',
      new.portfolio_id, current_staff_count, sub.seats_included
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_seat_limit on public.profiles;
create trigger trg_check_seat_limit
  before insert or update of portfolio_id, hoa_role on public.profiles
  for each row execute function public.check_seat_limit();

-- Maintain subscriptions.seats_used whenever staff profiles are added/moved
create or replace function public.recount_seats_used()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  affected uuid;
begin
  -- Recount for both the old and new portfolio when relevant
  for affected in
    select distinct p from (values (new.portfolio_id), (case when tg_op = 'UPDATE' then old.portfolio_id end)) v(p)
    where p is not null
  loop
    update public.subscriptions
       set seats_used = (select count(*) from public.profiles
                         where portfolio_id = affected and hoa_role = 'manager'),
           updated_at = now()
     where portfolio_id = affected;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_recount_seats on public.profiles;
create trigger trg_recount_seats
  after insert or update of portfolio_id, hoa_role or delete on public.profiles
  for each row execute function public.recount_seats_used();

-- -----------------------------------------------------------------------------
-- 6. Tier check helper
-- -----------------------------------------------------------------------------
create or replace function public.has_entitlement(p_portfolio_id uuid, p_feature_key text)
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select exists (
    select 1
      from public.portfolios p
      join public.feature_entitlements fe on true
     where p.id = p_portfolio_id
       and fe.key = p_feature_key
       and case
             when fe.min_tier = 'core' then true
             when fe.min_tier = 'plus' then p.tier in ('plus','max')
             when fe.min_tier = 'max'  then p.tier = 'max'
           end
       and p.suspended_at is null
  );
$$;

grant execute on function public.has_entitlement(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. usage_metrics — per-portfolio per-period counters
-- -----------------------------------------------------------------------------
create table public.usage_metrics (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  period_year integer not null check (period_year between 2000 and 2100),
  period_month smallint not null check (period_month between 1 and 12),
  staff_count integer not null default 0,
  homeowner_count integer not null default 0,
  association_count integer not null default 0,
  unit_count integer not null default 0,
  work_orders_created integer not null default 0,
  service_requests_created integer not null default 0,
  bills_posted integer not null default 0,
  payments_received integer not null default 0,
  emails_sent integer not null default 0,
  sms_sent integer not null default 0,
  api_calls integer not null default 0,
  storage_bytes bigint not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (portfolio_id, period_year, period_month)
);
create index idx_usage_metrics_portfolio_period on public.usage_metrics(portfolio_id, period_year desc, period_month desc);
create trigger trg_usage_metrics_updated before update on public.usage_metrics
  for each row execute function public.touch_updated_at();

alter table public.usage_metrics enable row level security;
create policy usage_metrics_platform_all on public.usage_metrics
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());
create policy usage_metrics_admin_read on public.usage_metrics
  for select to authenticated
  using (public.can_admin_portfolio(portfolio_id));

comment on table public.usage_metrics is 'Per-portfolio monthly counters for billing, capacity planning, and trend analysis. Populated by a monthly aggregator job.';

-- -----------------------------------------------------------------------------
-- 8. Monthly usage aggregator (pg_cron, 1st of month 01:30 UTC)
-- -----------------------------------------------------------------------------
create or replace function public.aggregate_usage_metrics(p_year integer, p_month integer)
returns void
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  period_start timestamptz := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  period_end   timestamptz := period_start + interval '1 month';
begin
  insert into public.usage_metrics (
    portfolio_id, period_year, period_month,
    staff_count, homeowner_count, association_count, unit_count,
    work_orders_created, service_requests_created, bills_posted,
    payments_received, emails_sent, sms_sent, api_calls
  )
  select
    p.id,
    p_year,
    p_month,
    coalesce((select count(*) from public.profiles where portfolio_id = p.id and hoa_role = 'manager'), 0),
    coalesce((select count(*) from public.profiles where portfolio_id = p.id and hoa_role in ('owner','tenant')), 0),
    coalesce((select count(*) from public.associations where portfolio_id = p.id and archived_at is null), 0),
    coalesce((select count(*) from public.units u
              join public.buildings b on b.id = u.building_id
              join public.associations a on a.id = b.association_id
              where a.portfolio_id = p.id and u.archived_at is null), 0),
    coalesce((select count(*) from public.work_orders w
              where w.portfolio_id = p.id and w.created_at >= period_start and w.created_at < period_end), 0),
    coalesce((select count(*) from public.service_requests s
              where s.portfolio_id = p.id and s.created_at >= period_start and s.created_at < period_end), 0),
    coalesce((select count(*) from public.payable_bills b
              where b.portfolio_id = p.id and b.created_at >= period_start and b.created_at < period_end), 0),
    coalesce((select count(*) from public.payments pm
              join public.units u on u.id = pm.unit_id
              join public.buildings b on b.id = u.building_id
              join public.associations a on a.id = b.association_id
              where a.portfolio_id = p.id and pm.created_at >= period_start and pm.created_at < period_end), 0),
    coalesce((select count(*) from public.email_queue eq
              join public.associations a on a.id = eq.association_id
              where a.portfolio_id = p.id and eq.sent_at >= period_start and eq.sent_at < period_end), 0),
    coalesce((select count(*) from public.sms_messages sm
              join public.sms_conversations sc on sc.id = sm.conversation_id
              where sc.portfolio_id = p.id and sm.created_at >= period_start and sm.created_at < period_end), 0),
    0  -- api_calls populated by the api_keys layer in Phase 9c
  from public.portfolios p
  on conflict (portfolio_id, period_year, period_month) do update set
    staff_count = excluded.staff_count,
    homeowner_count = excluded.homeowner_count,
    association_count = excluded.association_count,
    unit_count = excluded.unit_count,
    work_orders_created = excluded.work_orders_created,
    service_requests_created = excluded.service_requests_created,
    bills_posted = excluded.bills_posted,
    payments_received = excluded.payments_received,
    emails_sent = excluded.emails_sent,
    sms_sent = excluded.sms_sent,
    updated_at = now();
end;
$$;

-- Run for the previous completed month every day at 1:30 AM UTC
-- (daily for up-to-date metrics; the on-conflict clause makes it idempotent)
select cron.schedule(
  'aggregate-usage-metrics-daily',
  '30 1 * * *',
  $$ select public.aggregate_usage_metrics(extract(year from now())::int, extract(month from now())::int); $$
);
-- And for the previous month (to backfill if a month rolled over without a run)
select cron.schedule(
  'aggregate-usage-metrics-prev-month',
  '45 1 1-3 * *',
  $$ select public.aggregate_usage_metrics(
       extract(year from (now() - interval '1 month'))::int,
       extract(month from (now() - interval '1 month'))::int
     ); $$
);
;
