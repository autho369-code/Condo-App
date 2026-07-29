-- Online payments infrastructure (Stripe intake -> ledger -> bank reconciliation).
--
-- DESIGN (hierarchy of truth: Portier ledger -> Stripe -> bank):
--   payment_intents  = lifecycle of each online payment attempt. When Stripe
--                      confirms success, a normal `payments` row is inserted
--                      (same accounting path as a manager-recorded payment:
--                      trg_auto_apply_payment clears charges, unit_balances /
--                      aged_receivables update instantly). No parallel books.
--   payout_batches   = Stripe payouts (money actually moving to the bank).
--                      Reconciliation = match a payout to (a) the sum of the
--                      succeeded intents it settles and (b) the Plaid
--                      bank_transactions deposit. Unmatched -> exception queue.
--
-- GL note: v1 intentionally posts NO additional journal entries — identical
-- to how manager-recorded payments behave today, so income is never double
-- counted. A clearing-account JE flow (Dr Clearing/Cr AR at success, then
-- Dr Cash/Cr Clearing at payout) can be layered on later with accountant
-- sign-off.

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id),
  association_id uuid not null references public.associations(id),
  unit_id uuid not null references public.units(id),
  owner_id uuid not null references public.owners(id),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'usd',
  method text,                                   -- ach_debit | card | apple_pay | google_pay (set from Stripe)
  status text not null default 'pending'
    check (status in ('pending','processing','succeeded','failed','canceled','returned','refunded','chargeback')),
  processor text not null default 'stripe',
  processor_session_id text,                     -- Stripe Checkout session id
  processor_payment_intent_id text,              -- Stripe PaymentIntent id
  processor_charge_id text,
  processor_payout_id text,                      -- set when Stripe reports the payout that settled this charge
  payment_id uuid references public.payments(id),-- the ledger payment row created on success
  failure_reason text,
  breakdown jsonb not null default '[]'::jsonb,  -- [{description, amount}] snapshot of what the owner was paying
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  succeeded_at timestamptz,
  settled_at timestamptz
);

create index if not exists idx_payment_intents_portfolio on public.payment_intents (portfolio_id, status);
create index if not exists idx_payment_intents_owner on public.payment_intents (owner_id);
create unique index if not exists idx_payment_intents_session on public.payment_intents (processor_session_id) where processor_session_id is not null;
create index if not exists idx_payment_intents_payout on public.payment_intents (processor_payout_id) where processor_payout_id is not null;

alter table public.payment_intents enable row level security;

create policy payment_intents_finance_all on public.payment_intents
  for all to authenticated
  using (is_platform_operator() or can_manage_finance(portfolio_id))
  with check (is_platform_operator() or can_manage_finance(portfolio_id));

create policy payment_intents_owner_read on public.payment_intents
  for select to authenticated
  using (is_portal_resident() and owner_id = current_owner_id());

create table if not exists public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id),
  association_id uuid references public.associations(id),
  processor text not null default 'stripe',
  processor_payout_id text not null,
  amount numeric(12,2) not null,
  currency text not null default 'usd',
  arrival_date date,
  status text not null default 'pending'
    check (status in ('pending','paid','matched','reconciled','needs_review','failed')),
  expected_amount numeric(12,2),                 -- sum of intents attributed to this payout
  bank_transaction_id uuid references public.bank_transactions(id),
  matched_at timestamptz,
  match_method text,                             -- exact_amount | reference | manual
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_payout_batches_processor on public.payout_batches (processor, processor_payout_id);
create index if not exists idx_payout_batches_status on public.payout_batches (portfolio_id, status);

alter table public.payout_batches enable row level security;

create policy payout_batches_finance_all on public.payout_batches
  for all to authenticated
  using (is_platform_operator() or can_manage_finance(portfolio_id))
  with check (is_platform_operator() or can_manage_finance(portfolio_id));
