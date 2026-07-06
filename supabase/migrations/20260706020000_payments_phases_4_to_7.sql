-- Payment platform Phases 4–7 (founder spec 2026-07-06).
--
-- Phase 5 — Allocation Engine: per-association, manager-configurable payment
--   application order (replaces the hardcoded late-fees-first priority).
-- Phase 4 — Smart AutoPay: modes on autopay_mandates (fixed / current
--   balance / minimum / recurring-only / special-only), late-fee inclusion,
--   skip-a-month / vacation mode, per-run withdrawal cap (already existed).
-- Phase 6 — Trust accounting: formal fund types on bank accounts and a
--   hard guard: cross-fund transfers require explicit authorization.
-- Phase 7 — Payment timeline: append-only payment_events audit trail.

-- ── Phase 5: configurable allocation order ─────────────────────────────────
alter table public.associations
  add column if not exists payment_allocation_order text[] not null
    default array['late_fee','nsf_fee','fine','interest','legal','special_assessment','assessment','other'];

-- New strategy 'association_policy': iterate open charges in the association's
-- configured class order (unknown classes sort last), oldest due first within
-- a class. Existing strategies are preserved verbatim.
create or replace function public.apply_payment(p_payment_id uuid, p_strategy text DEFAULT 'auto_oldest_first'::text, p_charge_ids uuid[] DEFAULT NULL::uuid[])
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  pay public.payments;
  remaining numeric(14,2);
  charge_row record;
  to_apply numeric(14,2);
  applied_total numeric(14,2) := 0;
  applications_made jsonb := '[]'::jsonb;
  alloc_order text[];
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment % not found', p_payment_id; end if;

  remaining := pay.amount - coalesce(
    (select sum(amount_applied) from public.payment_applications where payment_id = p_payment_id),
    0
  );

  if remaining <= 0 then
    return jsonb_build_object(
      'payment_id', p_payment_id,
      'applied_total', 0,
      'remaining', 0,
      'note', 'payment is already fully applied'
    );
  end if;

  if p_strategy = 'association_policy' then
    -- The association's configured order; falls back to the default array.
    select a.payment_allocation_order into alloc_order
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id
     where u.id = pay.unit_id;
    if alloc_order is null then
      alloc_order := array['late_fee','nsf_fee','fine','interest','legal','special_assessment','assessment','other'];
    end if;

    for charge_row in
      select c.id as charge_id,
             (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as bal
        from public.charges c
       where c.unit_id = pay.unit_id
         and (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) > 0
       order by
         coalesce(array_position(alloc_order, c.charge_type::text), 999),
         c.due_date, c.created_at
    loop
      exit when remaining <= 0;
      to_apply := least(remaining, charge_row.bal);
      if to_apply > 0 then
        insert into public.payment_applications (payment_id, charge_id, amount_applied, applied_by, application_method)
        values (p_payment_id, charge_row.charge_id, to_apply, auth.uid(), 'association_policy');
        remaining := remaining - to_apply;
        applied_total := applied_total + to_apply;
        applications_made := applications_made || jsonb_build_object('charge_id', charge_row.charge_id, 'amount', to_apply);
      end if;
    end loop;

  elsif p_strategy = 'auto_late_fees_first' then
    for charge_row in
      select c.id as charge_id, c.charge_type, c.due_date,
             (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as bal
        from public.charges c
       where c.unit_id = pay.unit_id
         and (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) > 0
       order by
         case c.charge_type
           when 'late_fee' then 1
           when 'nsf_fee' then 2
           when 'fine' then 3
           when 'assessment' then 4
           when 'special_assessment' then 5
           else 9
         end,
         c.due_date
    loop
      exit when remaining <= 0;
      to_apply := least(remaining, charge_row.bal);
      if to_apply > 0 then
        insert into public.payment_applications (payment_id, charge_id, amount_applied, applied_by, application_method)
        values (p_payment_id, charge_row.charge_id, to_apply, auth.uid(), 'auto_late_fees_first');
        remaining := remaining - to_apply;
        applied_total := applied_total + to_apply;
        applications_made := applications_made || jsonb_build_object('charge_id', charge_row.charge_id, 'amount', to_apply);
      end if;
    end loop;

  elsif p_strategy = 'auto_specific' then
    if p_charge_ids is null or array_length(p_charge_ids, 1) is null then
      raise exception 'auto_specific strategy requires p_charge_ids';
    end if;
    for charge_row in
      select c.id as charge_id,
             (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as bal
        from public.charges c
       where c.unit_id = pay.unit_id
         and c.id = any(p_charge_ids)
         and (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) > 0
       order by array_position(p_charge_ids, c.id)
    loop
      exit when remaining <= 0;
      to_apply := least(remaining, charge_row.bal);
      if to_apply > 0 then
        insert into public.payment_applications (payment_id, charge_id, amount_applied, applied_by, application_method)
        values (p_payment_id, charge_row.charge_id, to_apply, auth.uid(), 'auto_specific');
        remaining := remaining - to_apply;
        applied_total := applied_total + to_apply;
        applications_made := applications_made || jsonb_build_object('charge_id', charge_row.charge_id, 'amount', to_apply);
      end if;
    end loop;

  else  -- default: auto_oldest_first
    for charge_row in
      select c.id as charge_id,
             (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as bal
        from public.charges c
       where c.unit_id = pay.unit_id
         and (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) > 0
       order by c.due_date, c.created_at
    loop
      exit when remaining <= 0;
      to_apply := least(remaining, charge_row.bal);
      if to_apply > 0 then
        insert into public.payment_applications (payment_id, charge_id, amount_applied, applied_by, application_method)
        values (p_payment_id, charge_row.charge_id, to_apply, auth.uid(), 'auto_oldest_first');
        remaining := remaining - to_apply;
        applied_total := applied_total + to_apply;
        applications_made := applications_made || jsonb_build_object('charge_id', charge_row.charge_id, 'amount', to_apply);
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'strategy', p_strategy,
    'applied_total', applied_total,
    'remaining_credit', remaining,
    'applications', applications_made
  );
end;
$function$;

-- Payments now apply per the ASSOCIATION'S configured policy by default.
create or replace function public.auto_apply_new_payment()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.charge_id is not null then
    insert into public.payment_applications (payment_id, charge_id, amount_applied, applied_by, application_method)
    values (new.id, new.charge_id, new.amount, new.created_by, 'auto_specific')
    on conflict do nothing;
  else
    perform public.apply_payment(new.id, 'association_policy');
  end if;
  return new;
end;
$function$;

-- ── Phase 4: smart AutoPay modes ───────────────────────────────────────────
alter table public.autopay_mandates
  add column if not exists mode text not null default 'current_balance'
    check (mode in ('fixed','current_balance','minimum','recurring_only','special_only')),
  add column if not exists fixed_amount_cents integer,
  add column if not exists minimum_amount_cents integer,
  add column if not exists include_late_fees boolean not null default true,
  add column if not exists skip_until date;  -- skip-a-month / vacation mode

-- ── Phase 6: trust accounting fund types + transfer guard ──────────────────
alter table public.bank_accounts
  add column if not exists fund_type text not null default 'operating'
    check (fund_type in ('operating','reserve','insurance_proceeds','special_assessment','construction_escrow','petty_cash'));

update public.bank_accounts
   set fund_type = 'reserve'
 where purpose is not null
   and lower(purpose::text) like '%reserve%'
   and fund_type = 'operating';

alter table public.bank_transfers
  add column if not exists authorized_by uuid references auth.users(id),
  add column if not exists authorization_note text;

create or replace function public.guard_cross_fund_transfer()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  from_fund text;
  to_fund text;
begin
  select fund_type into from_fund from public.bank_accounts where id = new.from_bank_account_id;
  select fund_type into to_fund from public.bank_accounts where id = new.to_bank_account_id;
  if from_fund is distinct from to_fund and new.authorized_by is null then
    raise exception 'Transfers between % and % funds require explicit authorization (set authorized_by with an authorization note).', from_fund, to_fund;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_cross_fund_transfer on public.bank_transfers;
create trigger trg_guard_cross_fund_transfer
  before insert or update on public.bank_transfers
  for each row execute function public.guard_cross_fund_transfer();

-- ── Phase 7: payment timeline (append-only audit trail) ────────────────────
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.payment_intents(id) on delete cascade,
  event text not null,      -- initiated | checkout_created | stripe_accepted | ledger_posted |
                            -- receipt_emailed | settlement_pending | payout_created |
                            -- bank_deposit_detected | reconciled | failed | returned | refunded | chargeback
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_events_intent on public.payment_events (payment_intent_id, created_at);

alter table public.payment_events enable row level security;

create policy payment_events_finance_read on public.payment_events
  for select to authenticated
  using (exists (
    select 1 from public.payment_intents pi
    where pi.id = payment_events.payment_intent_id
      and (is_platform_operator() or can_manage_finance(pi.portfolio_id))
  ));

create policy payment_events_owner_read on public.payment_events
  for select to authenticated
  using (exists (
    select 1 from public.payment_intents pi
    where pi.id = payment_events.payment_intent_id
      and is_portal_resident() and pi.owner_id = current_owner_id()
  ));

-- Phase 8 support: capture processor fees per payment when available.
alter table public.payment_intents
  add column if not exists processor_fee_cents integer;

-- Allow the new application method in payment_applications' CHECK constraint
-- (caught by a rolled-back dry-run — the original list predates the engine).
alter table public.payment_applications
  drop constraint payment_applications_application_method_check;
alter table public.payment_applications
  add constraint payment_applications_application_method_check
  check (application_method = any (array['manual','auto_oldest_first','auto_late_fees_first','auto_specific','credit_application','association_policy']));
