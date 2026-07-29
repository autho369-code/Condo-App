-- =============================================================================
-- Phase 17 — Multi-processor payments + autopay + convenience fees + lockbox
-- Goal: minimize homeowner payment cost by defaulting to ACH, passing card
-- fees through, and supporting multiple processors so you can switch as
-- volume grows (Stripe → Dwolla → Modern Treasury).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Payment processor enum + per-portfolio configuration
-- -----------------------------------------------------------------------------
create type public.payment_processor as enum (
  'stripe', 'dwolla', 'modern_treasury', 'gocardless', 'square', 'paypal', 'manual'
);

create type public.convenience_fee_mode as enum (
  'absorb',       -- management co eats the fee
  'pass_through', -- homeowner pays 100% of processor fee
  'split',        -- split 50/50 (configurable)
  'flat_addon'    -- add a flat $ convenience fee per card transaction
);

create table public.payment_processor_configs (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  processor public.payment_processor not null,
  is_active boolean not null default false,
  is_default boolean not null default false,
  supports_ach boolean not null default true,
  supports_card boolean not null default true,
  supports_apple_pay boolean not null default false,
  -- Credential reference in Vault (e.g., "stripe_secret_key_<portfolio_id>")
  vault_secret_name text,
  public_key text,  -- publishable key (safe to expose)
  webhook_secret_vault_name text,
  -- Per-processor fee model (hints only; real fee comes back with each txn)
  ach_fee_bps integer check (ach_fee_bps >= 0),             -- basis points (e.g., 80 = 0.8%)
  ach_fee_cap_cents integer,
  ach_fee_fixed_cents integer,
  card_fee_bps integer,
  card_fee_fixed_cents integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, processor)
);
create index idx_processor_configs_portfolio on public.payment_processor_configs(portfolio_id) where is_active;
create unique index uq_default_processor_per_portfolio on public.payment_processor_configs(portfolio_id)
  where is_default and is_active;
create trigger trg_processor_configs_updated before update on public.payment_processor_configs
  for each row execute function public.touch_updated_at();

alter table public.payment_processor_configs enable row level security;
create policy processor_configs_admin on public.payment_processor_configs
  for all to authenticated
  using (public.can_admin_portfolio(portfolio_id)) with check (public.can_admin_portfolio(portfolio_id));
create policy processor_configs_staff_read on public.payment_processor_configs
  for select to authenticated using (public.can_access_portfolio(portfolio_id));

comment on table public.payment_processor_configs is 'Per-portfolio processor setup. Stripe default; add Dwolla for lower-cost ACH at scale, Modern Treasury for enterprise. Credentials via Supabase Vault.';

-- Seed default Stripe row per existing portfolio (zero today, but pattern for future)
-- Users can enable Stripe by updating is_active + vault_secret_name later.

-- -----------------------------------------------------------------------------
-- 2. Convenience fee configuration
-- -----------------------------------------------------------------------------
alter table public.portfolios
  add column convenience_fee_mode public.convenience_fee_mode not null default 'pass_through',
  add column convenience_fee_card_pct numeric(5,3) not null default 2.9 check (convenience_fee_card_pct >= 0 and convenience_fee_card_pct <= 10),
  add column convenience_fee_card_fixed_cents integer not null default 30 check (convenience_fee_card_fixed_cents >= 0),
  add column convenience_fee_ach_pct numeric(5,3) not null default 0 check (convenience_fee_ach_pct >= 0),
  add column convenience_fee_ach_fixed_cents integer not null default 0 check (convenience_fee_ach_fixed_cents >= 0),
  add column convenience_fee_minimum_cents integer not null default 0,
  add column convenience_fee_label text not null default 'Processing fee';

comment on column public.portfolios.convenience_fee_mode is 'How to handle processor fees. pass_through is the cheapest path for the management company.';

-- Helper: compute the convenience fee charged to the owner for a given amount+method
create or replace function public.calculate_convenience_fee(
  p_portfolio_id uuid,
  p_amount_cents bigint,
  p_method text
)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare
  pf public.portfolios;
  fee_pct numeric := 0;
  fee_fixed integer := 0;
  fee_cents integer := 0;
  owner_pays integer := 0;
begin
  select * into pf from public.portfolios where id = p_portfolio_id;
  if not found then
    return jsonb_build_object('error', 'portfolio not found');
  end if;

  if p_method in ('card','credit_card','debit_card') then
    fee_pct := pf.convenience_fee_card_pct;
    fee_fixed := pf.convenience_fee_card_fixed_cents;
  elsif p_method in ('ach','echeck','bank_transfer') then
    fee_pct := pf.convenience_fee_ach_pct;
    fee_fixed := pf.convenience_fee_ach_fixed_cents;
  else
    return jsonb_build_object('fee_cents', 0, 'owner_pays_cents', p_amount_cents);
  end if;

  fee_cents := round((p_amount_cents * fee_pct / 100.0) + fee_fixed);
  fee_cents := greatest(fee_cents, pf.convenience_fee_minimum_cents);

  case pf.convenience_fee_mode
    when 'absorb'       then owner_pays := p_amount_cents;
    when 'pass_through' then owner_pays := p_amount_cents + fee_cents;
    when 'split'        then owner_pays := p_amount_cents + (fee_cents / 2);
    when 'flat_addon'   then owner_pays := p_amount_cents + pf.convenience_fee_card_fixed_cents;
  end case;

  return jsonb_build_object(
    'fee_cents', fee_cents,
    'owner_pays_cents', owner_pays,
    'mode', pf.convenience_fee_mode,
    'label', pf.convenience_fee_label
  );
end;
$$;

grant execute on function public.calculate_convenience_fee(uuid, bigint, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Extend payment_intents for multi-processor support
-- -----------------------------------------------------------------------------
alter table public.payment_intents
  add column processor public.payment_processor not null default 'stripe',
  add column processor_payment_id text,  -- generic: Dwolla transfer id, MT payment id, etc.
  add column processor_fee_cents integer,
  add column convenience_fee_cents integer not null default 0,
  add column owner_paid_cents integer,  -- what the homeowner actually paid (amount × 100 + convenience fee)
  add column net_to_association_cents integer;  -- what association receives after fees
create index idx_payment_intents_processor on public.payment_intents(processor);
create index idx_payment_intents_processor_id on public.payment_intents(processor_payment_id) where processor_payment_id is not null;

-- -----------------------------------------------------------------------------
-- 4. owner-side payment_methods (tokenized)
-- -----------------------------------------------------------------------------
create type public.payment_method_type as enum (
  'bank_account_ach', 'bank_account_echeck', 'card_credit', 'card_debit', 'paypal', 'apple_pay', 'google_pay'
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  processor public.payment_processor not null,
  method_type public.payment_method_type not null,
  -- Tokenized — never store raw PAN/ACH numbers here
  processor_token text not null,  -- pm_xxx, ba_xxx, etc.
  processor_customer_id text,     -- cus_xxx for Stripe, customer id for Dwolla
  last_four text,                  -- last 4 of card or account for display
  brand text,                      -- Visa/Mastercard/Bank name
  exp_month smallint check (exp_month is null or exp_month between 1 and 12),
  exp_year smallint check (exp_year is null or exp_year between 2020 and 2100),
  bank_name text,
  account_type text check (account_type in ('checking','savings') or account_type is null),
  is_default boolean not null default false,
  is_verified boolean not null default false,
  verified_at timestamptz,
  failed_attempts integer not null default 0,
  last_failure_at timestamptz,
  last_failure_reason text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_payment_methods_owner on public.payment_methods(owner_id) where archived_at is null;
create index idx_payment_methods_portfolio on public.payment_methods(portfolio_id);
create unique index uq_payment_method_default_per_owner on public.payment_methods(owner_id)
  where is_default and archived_at is null;
create trigger trg_payment_methods_updated before update on public.payment_methods
  for each row execute function public.touch_updated_at();

alter table public.payment_methods enable row level security;
create policy payment_methods_staff on public.payment_methods
  for select to authenticated using (public.can_access_portfolio(portfolio_id));
create policy payment_methods_owner_self on public.payment_methods
  for all to authenticated
  using (owner_id = public.current_owner_id())
  with check (owner_id = public.current_owner_id());
create policy payment_methods_finance_write on public.payment_methods
  for all to authenticated
  using (public.can_manage_finance(portfolio_id))
  with check (public.can_manage_finance(portfolio_id));

comment on table public.payment_methods is 'Tokenized payment methods on file per homeowner. Raw card/bank numbers are NEVER stored — only processor tokens. Satisfies PCI-DSS / NACHA.';

-- -----------------------------------------------------------------------------
-- 5. Autopay mandates (recurring ACH / card authorization)
-- -----------------------------------------------------------------------------
create type public.autopay_frequency as enum ('monthly', 'quarterly', 'annually', 'on_charge_posted');
create type public.autopay_status as enum ('pending_verification', 'active', 'paused', 'canceled', 'failed');

create table public.autopay_mandates (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  -- Authorization: what the owner agreed to
  authorized_amount_max_cents integer not null check (authorized_amount_max_cents > 0),
  frequency public.autopay_frequency not null default 'on_charge_posted',
  day_of_month smallint check (day_of_month is null or day_of_month between 1 and 28),
  start_date date not null default current_date,
  end_date date,
  status public.autopay_status not null default 'pending_verification',
  -- Signed authorization
  mandate_signed_at timestamptz,
  mandate_ip_address text,
  mandate_user_agent text,
  mandate_document_url text,
  -- Processor-side mandate
  processor_mandate_id text,  -- Stripe Mandate ID, Dwolla recurring customer, etc.
  -- Run tracking
  next_run_date date,
  last_run_at timestamptz,
  last_run_payment_intent_id uuid references public.payment_intents(id) on delete set null,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  last_failure_at timestamptz,
  last_failure_reason text,
  paused_at timestamptz,
  paused_reason text,
  canceled_at timestamptz,
  canceled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_autopay_portfolio on public.autopay_mandates(portfolio_id);
create index idx_autopay_owner on public.autopay_mandates(owner_id);
create index idx_autopay_unit on public.autopay_mandates(unit_id);
create index idx_autopay_due on public.autopay_mandates(next_run_date) where status = 'active';
create index idx_autopay_status on public.autopay_mandates(status);
create trigger trg_autopay_updated before update on public.autopay_mandates
  for each row execute function public.touch_updated_at();

alter table public.autopay_mandates enable row level security;
create policy autopay_staff on public.autopay_mandates
  for select to authenticated using (public.can_access_portfolio(portfolio_id));
create policy autopay_finance_all on public.autopay_mandates
  for all to authenticated
  using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));
create policy autopay_owner_self on public.autopay_mandates
  for all to authenticated
  using (owner_id = public.current_owner_id())
  with check (owner_id = public.current_owner_id());

comment on table public.autopay_mandates is 'Recurring-payment authorization from the homeowner. ACH autopay is the single biggest processor-cost saver vs one-off card payments.';

-- -----------------------------------------------------------------------------
-- 6. Lockbox deposits (paper-check scanning services: CheckAlt, Remit Plus)
-- -----------------------------------------------------------------------------
create type public.lockbox_batch_status as enum ('received','processing','deposited','reconciled','rejected');

create table public.lockbox_batches (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  provider text not null,  -- 'checkalt', 'remit_plus', 'wells_fargo_lockbox', etc.
  provider_batch_id text,
  batch_date date not null default current_date,
  total_items integer not null default 0,
  total_amount_cents bigint not null default 0,
  status public.lockbox_batch_status not null default 'received',
  deposit_reference text,
  received_at timestamptz not null default now(),
  deposited_at timestamptz,
  reconciled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_lockbox_batches_portfolio on public.lockbox_batches(portfolio_id, batch_date desc);
create index idx_lockbox_batches_status on public.lockbox_batches(status);
create trigger trg_lockbox_batches_updated before update on public.lockbox_batches
  for each row execute function public.touch_updated_at();

alter table public.lockbox_batches enable row level security;
create policy lockbox_batches_finance on public.lockbox_batches
  for all to authenticated
  using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));

create table public.lockbox_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.lockbox_batches(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  owner_id uuid references public.owners(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  check_number text,
  check_amount_cents bigint not null check (check_amount_cents > 0),
  routing_number text,  -- masked
  account_number_masked text,
  payer_name text,
  scan_url text,
  matched_confidence numeric(5,2) check (matched_confidence is null or (matched_confidence between 0 and 100)),
  manually_matched boolean not null default false,
  rejected boolean not null default false,
  rejection_reason text,
  created_at timestamptz not null default now()
);
create index idx_lockbox_items_batch on public.lockbox_items(batch_id);
create index idx_lockbox_items_unit on public.lockbox_items(unit_id) where not rejected;
create index idx_lockbox_items_payment on public.lockbox_items(payment_id);

alter table public.lockbox_items enable row level security;
create policy lockbox_items_finance on public.lockbox_items
  for all to authenticated
  using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));

comment on table public.lockbox_batches is 'Paper-check lockbox feeds. Provider scans + ACH-deposits the checks; we import the batch and auto-match to units.';
comment on table public.lockbox_items is 'Individual check within a lockbox batch. matched_confidence = fuzzy match score to a unit/owner.';

-- -----------------------------------------------------------------------------
-- 7. Processor routing helper: pick the best active processor for a method
-- -----------------------------------------------------------------------------
create or replace function public.select_payment_processor(
  p_portfolio_id uuid,
  p_method text
)
returns public.payment_processor
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare
  chosen public.payment_processor;
begin
  -- Prefer configured default if it supports the method
  select processor into chosen
    from public.payment_processor_configs
   where portfolio_id = p_portfolio_id
     and is_active
     and is_default
     and (
       (p_method in ('ach','echeck') and supports_ach)
       or (p_method in ('card','credit_card','debit_card') and supports_card)
     )
   limit 1;

  if chosen is not null then
    return chosen;
  end if;

  -- Fall back to cheapest ACH processor configured
  if p_method in ('ach','echeck') then
    select processor into chosen
      from public.payment_processor_configs
     where portfolio_id = p_portfolio_id and is_active and supports_ach
     order by coalesce(ach_fee_fixed_cents, 999999) + coalesce(ach_fee_bps, 0) * 10
     limit 1;
  else
    select processor into chosen
      from public.payment_processor_configs
     where portfolio_id = p_portfolio_id and is_active and supports_card
     order by coalesce(card_fee_bps, 0) * 10 + coalesce(card_fee_fixed_cents, 0)
     limit 1;
  end if;

  return coalesce(chosen, 'stripe'::public.payment_processor);
end;
$$;

grant execute on function public.select_payment_processor(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. Autopay runner (daily cron) — picks mandates due today, creates payment_intents
-- -----------------------------------------------------------------------------
create or replace function public.run_autopay_mandates()
returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  m record;
  n integer := 0;
  amount_cents integer;
  target_charge_id uuid;
begin
  for m in
    select am.*
      from public.autopay_mandates am
     where am.status = 'active'
       and am.next_run_date <= current_date
       and (am.end_date is null or current_date <= am.end_date)
  loop
    -- Find outstanding dues for this owner/unit
    select c.id,
           (c.amount - coalesce((select sum(amount) from public.payments where charge_id = c.id), 0))::integer * 100
      into target_charge_id, amount_cents
      from public.charges c
     where c.unit_id = m.unit_id
       and c.charge_type = 'assessment'
       and (c.amount - coalesce((select sum(amount) from public.payments where charge_id = c.id), 0)) > 0
     order by c.due_date
     limit 1;

    if amount_cents is not null and amount_cents > 0
       and amount_cents <= m.authorized_amount_max_cents then

      -- Create pending payment_intent (edge function will execute the charge via processor)
      insert into public.payment_intents (
        unit_id, owner_id, charge_id, amount, method, description,
        processor, metadata, status
      ) values (
        m.unit_id, m.owner_id, target_charge_id,
        (amount_cents / 100.0)::numeric(14,2),
        'ach',
        'Autopay mandate ' || m.id::text,
        (select processor from public.payment_methods where id = m.payment_method_id),
        jsonb_build_object('autopay_mandate_id', m.id, 'payment_method_id', m.payment_method_id),
        'pending'
      );

      -- Advance next_run_date based on frequency
      update public.autopay_mandates
         set next_run_date = case frequency
               when 'monthly'          then current_date + interval '1 month'
               when 'quarterly'        then current_date + interval '3 months'
               when 'annually'         then current_date + interval '1 year'
               when 'on_charge_posted' then null  -- event-driven; advanced when next charge posts
             end::date,
             last_run_at = now(),
             updated_at = now()
       where id = m.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

select cron.schedule(
  'run-autopay-mandates-daily',
  '0 9 * * *',  -- 9 AM UTC = 5 AM ET; pre-business-hours
  $$ select public.run_autopay_mandates(); $$
);

-- -----------------------------------------------------------------------------
-- 9. Owner-facing RPCs
-- -----------------------------------------------------------------------------
create or replace function public.enroll_autopay(
  p_unit_id uuid,
  p_payment_method_id uuid,
  p_authorized_max_cents integer,
  p_frequency public.autopay_frequency default 'on_charge_posted'
)
returns public.autopay_mandates
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  m public.autopay_mandates;
  v_owner uuid := public.current_owner_id();
  v_portfolio uuid;
  v_assoc uuid;
begin
  if v_owner is null then
    raise exception 'must be logged in as a homeowner to enroll';
  end if;

  select a.portfolio_id, a.id into v_portfolio, v_assoc
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = p_unit_id;

  if not exists (
    select 1 from public.occupancies o
     where o.unit_id = p_unit_id and o.owner_id = v_owner and o.status = 'current'
  ) then
    raise exception 'you are not a current occupant of this unit';
  end if;

  if not exists (
    select 1 from public.payment_methods pm
     where pm.id = p_payment_method_id and pm.owner_id = v_owner and pm.archived_at is null
  ) then
    raise exception 'payment method not found or not owned by you';
  end if;

  insert into public.autopay_mandates (
    portfolio_id, association_id, owner_id, unit_id, payment_method_id,
    authorized_amount_max_cents, frequency, status,
    mandate_signed_at
  ) values (
    v_portfolio, v_assoc, v_owner, p_unit_id, p_payment_method_id,
    p_authorized_max_cents, p_frequency, 'active',
    now()
  ) returning * into m;
  return m;
end;
$$;

grant execute on function public.enroll_autopay(uuid, uuid, integer, public.autopay_frequency) to authenticated;

create or replace function public.cancel_autopay(p_mandate_id uuid, p_reason text default null)
returns public.autopay_mandates
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare m public.autopay_mandates;
begin
  select * into m from public.autopay_mandates where id = p_mandate_id;
  if not found then raise exception 'autopay mandate not found'; end if;
  if m.owner_id <> public.current_owner_id() and not public.can_manage_finance(m.portfolio_id) then
    raise exception 'permission denied';
  end if;
  update public.autopay_mandates
     set status = 'canceled', canceled_at = now(), canceled_by = auth.uid(),
         paused_reason = p_reason, updated_at = now()
   where id = p_mandate_id
   returning * into m;
  return m;
end;
$$;

grant execute on function public.cancel_autopay(uuid, text) to authenticated;
;
