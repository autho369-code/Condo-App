-- =============================================================================
-- Phase 18 — Payment application, vendor check defaults, utility auto-pay
--
-- Core idea: one homeowner payment can cover multiple charges, and one charge
-- can receive partial payments over time. The existing payments.charge_id
-- single-FK model can't represent this. Introduce payment_applications as the
-- source of truth for how money was applied.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. payment_applications — junction between payments and charges
-- -----------------------------------------------------------------------------
create table public.payment_applications (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  charge_id uuid not null references public.charges(id) on delete cascade,
  amount_applied numeric(14,2) not null check (amount_applied > 0),
  applied_at timestamptz not null default now(),
  applied_by uuid references auth.users(id) on delete set null,
  application_method text not null default 'manual' check (application_method in ('manual','auto_oldest_first','auto_late_fees_first','auto_specific','credit_application')),
  notes text,
  created_at timestamptz not null default now(),
  unique (payment_id, charge_id)
);
create index idx_payment_apps_payment on public.payment_applications(payment_id);
create index idx_payment_apps_charge on public.payment_applications(charge_id);
create index idx_payment_apps_applied on public.payment_applications(applied_at desc);

alter table public.payment_applications enable row level security;
create policy payment_apps_finance on public.payment_applications
  for all to authenticated
  using (exists (select 1 from public.payments p where p.id = payment_id
                 and exists (select 1 from public.units u
                             join public.buildings b on b.id = u.building_id
                             join public.associations a on a.id = b.association_id
                             where u.id = p.unit_id and public.can_manage_finance(a.portfolio_id))))
  with check (exists (select 1 from public.payments p where p.id = payment_id
                      and exists (select 1 from public.units u
                                  join public.buildings b on b.id = u.building_id
                                  join public.associations a on a.id = b.association_id
                                  where u.id = p.unit_id and public.can_manage_finance(a.portfolio_id))));
create policy payment_apps_resident_read on public.payment_applications
  for select to authenticated
  using (exists (select 1 from public.payments p where p.id = payment_id and p.unit_id in (select public.current_resident_unit_ids())));

comment on table public.payment_applications is 'One payment can cover many charges and one charge can receive many partial payments. Source of truth for payment application (not payments.charge_id).';
comment on column public.payment_applications.application_method is 'auto_oldest_first / auto_late_fees_first / auto_specific when applied automatically; manual when a staff user chose.';

-- Unique index: one application row per (payment, charge) pair (already enforced)

-- -----------------------------------------------------------------------------
-- 2. Charge balance view — uses payment_applications, not payments.charge_id
-- -----------------------------------------------------------------------------
create or replace view public.v_charge_balances
  with (security_invoker = true) as
select
  c.id as charge_id,
  c.unit_id,
  c.assessment_period_id,
  c.charge_type,
  c.description,
  c.amount as charged_amount,
  coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0) as applied_amount,
  c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0) as balance_due,
  c.due_date,
  case
    when c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0) <= 0 then 'paid'
    when coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0) = 0 then 'outstanding'
    else 'partial'
  end as payment_status,
  case
    when c.due_date < current_date
         and (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) > 0 then true
    else false
  end as is_past_due
from public.charges c;

comment on view public.v_charge_balances is 'Per-charge balance = charged - sum(payment_applications.amount_applied). This is the live status of every charge.';

-- -----------------------------------------------------------------------------
-- 3. apply_payment() — core payment application function with strategies
-- -----------------------------------------------------------------------------
create or replace function public.apply_payment(
  p_payment_id uuid,
  p_strategy text default 'auto_oldest_first',  -- auto_oldest_first | auto_late_fees_first | auto_specific
  p_charge_ids uuid[] default null  -- required when strategy = auto_specific
)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  pay public.payments;
  remaining numeric(14,2);
  charge_row record;
  to_apply numeric(14,2);
  applied_total numeric(14,2) := 0;
  applications_made jsonb := '[]'::jsonb;
  charges_cursor refcursor;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment % not found', p_payment_id; end if;

  -- How much of this payment is still unapplied?
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

  -- Choose charge iteration order based on strategy
  if p_strategy = 'auto_late_fees_first' then
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

  else  -- default: auto_oldest_first (standard HOA practice)
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
$$;

grant execute on function public.apply_payment(uuid, text, uuid[]) to authenticated, service_role;

comment on function public.apply_payment(uuid, text, uuid[]) is 'Applies a payment to outstanding charges. Strategies: auto_oldest_first (HOA default), auto_late_fees_first (pay fees before assessments), auto_specific (caller provides charge list). Leftover becomes an unapplied credit.';

-- -----------------------------------------------------------------------------
-- 4. Trigger on payments INSERT: auto-apply using oldest-first strategy
--    If payments.charge_id was specified, that's treated as a single-target
--    application for backward compat. Otherwise apply across outstanding charges.
-- -----------------------------------------------------------------------------
create or replace function public.auto_apply_new_payment()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  strategy text;
begin
  -- Use late_fees_first by default — the most common and correct HOA policy
  strategy := 'auto_late_fees_first';

  -- Caller explicitly targeted a single charge → apply just to that one
  if new.charge_id is not null then
    insert into public.payment_applications (payment_id, charge_id, amount_applied, applied_by, application_method)
    values (new.id, new.charge_id, new.amount, new.created_by, 'auto_specific')
    on conflict do nothing;
  else
    -- Otherwise, run the standard strategy
    perform public.apply_payment(new.id, strategy);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_apply_payment on public.payments;
create trigger trg_auto_apply_payment
  after insert on public.payments
  for each row execute function public.auto_apply_new_payment();

-- -----------------------------------------------------------------------------
-- 5. Unapplied credit view — "prepayments" / overpayments per unit
-- -----------------------------------------------------------------------------
create or replace view public.v_unapplied_credits
  with (security_invoker = true) as
select
  p.id as payment_id,
  p.unit_id,
  p.payment_date,
  p.amount,
  coalesce((select sum(amount_applied) from public.payment_applications where payment_id = p.id), 0) as applied_amount,
  p.amount - coalesce((select sum(amount_applied) from public.payment_applications where payment_id = p.id), 0) as unapplied_amount
from public.payments p
where p.amount - coalesce((select sum(amount_applied) from public.payment_applications where payment_id = p.id), 0) > 0.005;

comment on view public.v_unapplied_credits is 'Payments that still have an unapplied balance (homeowner credits / prepayments).';

-- Per-unit summary (rolls up credits and balances)
create or replace view public.v_unit_account_summary
  with (security_invoker = true) as
select
  u.id as unit_id,
  u.unit_number,
  b.association_id,
  a.portfolio_id,
  coalesce((select sum(amount) from public.charges where unit_id = u.id), 0) as total_charged,
  coalesce((select sum(amount) from public.payments where unit_id = u.id), 0) as total_paid,
  coalesce((select sum(amount_applied) from public.payment_applications pa
            join public.charges c on c.id = pa.charge_id where c.unit_id = u.id), 0) as total_applied,
  -- Outstanding balance = open charges
  coalesce((select sum(balance_due) from public.v_charge_balances vcb where vcb.unit_id = u.id and vcb.balance_due > 0), 0) as outstanding_balance,
  -- Credit balance = unapplied payment amounts
  coalesce((select sum(unapplied_amount) from public.v_unapplied_credits vuc where vuc.unit_id = u.id), 0) as unapplied_credit
from public.units u
join public.buildings b on b.id = u.building_id
join public.associations a on a.id = b.association_id
where u.archived_at is null;

-- -----------------------------------------------------------------------------
-- 6. Trigger on new charge: auto-apply available credit from same unit
-- -----------------------------------------------------------------------------
create or replace function public.auto_apply_credit_on_new_charge()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  credit_row record;
  remaining_charge numeric(14,2);
  to_apply numeric(14,2);
begin
  remaining_charge := new.amount;

  for credit_row in
    select payment_id, unapplied_amount
      from public.v_unapplied_credits
     where unit_id = new.unit_id
     order by payment_id  -- FIFO; could use payment_date for true oldest-first
  loop
    exit when remaining_charge <= 0;
    to_apply := least(remaining_charge, credit_row.unapplied_amount);
    if to_apply > 0 then
      insert into public.payment_applications (payment_id, charge_id, amount_applied, application_method)
      values (credit_row.payment_id, new.id, to_apply, 'credit_application')
      on conflict do nothing;
      remaining_charge := remaining_charge - to_apply;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_auto_apply_credit on public.charges;
create trigger trg_auto_apply_credit
  after insert on public.charges
  for each row execute function public.auto_apply_credit_on_new_charge();

-- -----------------------------------------------------------------------------
-- 7. Vendor defaults: payment_type = 'check', add is_auto_pay for utilities
-- -----------------------------------------------------------------------------
-- Set check as the default for new vendors
alter table public.vendors
  alter column payment_type set default 'check'::public.vendor_payment_type;

-- Add is_auto_pay flag for utility vendors
alter table public.vendors
  add column is_auto_pay boolean not null default false,
  add column auto_pay_setup_at timestamptz,
  add column auto_pay_notes text,
  add column is_utility boolean not null default false;

create index idx_vendors_auto_pay on public.vendors(portfolio_id) where is_auto_pay and not archived_at is not null;
create index idx_vendors_utility on public.vendors(portfolio_id) where is_utility;

comment on column public.vendors.payment_type is 'Default is ''check'' — most vendors are paid by check. Set to ''ach'' or ''echeck'' for utility auto-pay or portal-activated vendors.';
comment on column public.vendors.is_auto_pay is 'When true, bills from this vendor skip the manual check-writing queue and post straight to the bank account. Typically utilities (gas/electric/water).';
comment on column public.vendors.is_utility is 'Marks gas/electric/water/sewer/trash vendors. Used to pre-categorize bills and pre-fill GL accounts.';

-- Flag on recurring_bills: this bill auto-pays (utility) vs. needs check-writing
alter table public.recurring_bills
  add column is_auto_pay boolean not null default false;

comment on column public.recurring_bills.is_auto_pay is 'When true, the generated payable_bill is auto-approved and marked paid (matching the utility auto-debit from the bank). When false, staff writes a check.';

-- -----------------------------------------------------------------------------
-- 8. Extend the recurring-bills generator to mark auto-pay bills as paid
-- -----------------------------------------------------------------------------
create or replace function public.generate_recurring_bills()
returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  row record;
  next_due date;
  n integer := 0;
  new_bill_id uuid;
begin
  for row in
    select * from public.recurring_bills
     where auto_generate and archived_at is null
       and next_post_date <= current_date
       and (end_date is null or next_post_date <= end_date)
  loop
    insert into public.payable_bills (
      portfolio_id, vendor_id, association_id, gl_account_id, bank_account_id,
      bill_date, due_date, amount, memo, status, paid_at, approved_at, created_by
    ) values (
      row.portfolio_id, row.vendor_id, row.association_id, row.gl_account_id, row.bank_account_id,
      current_date, current_date + 30, row.amount,
      row.memo || ' (recurring)',
      case when row.is_auto_pay then 'paid'::public.payable_bill_status else 'draft'::public.payable_bill_status end,
      case when row.is_auto_pay then now() else null end,
      case when row.is_auto_pay then now() else null end,
      row.created_by
    ) returning id into new_bill_id;

    next_due := case row.frequency
      when 'daily'     then row.next_post_date + (row.interval_count || ' days')::interval
      when 'weekly'    then row.next_post_date + (row.interval_count || ' weeks')::interval
      when 'monthly'   then row.next_post_date + (row.interval_count || ' months')::interval
      when 'quarterly' then row.next_post_date + (row.interval_count * 3 || ' months')::interval
      when 'annually'  then row.next_post_date + (row.interval_count || ' years')::interval
    end::date;

    update public.recurring_bills
       set next_post_date = next_due, last_generated_at = now(), updated_at = now()
     where id = row.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Check-writing batch helper: pull all unpaid, non-auto-pay bills for check run
-- -----------------------------------------------------------------------------
create or replace view public.v_check_writing_queue
  with (security_invoker = true) as
select
  pb.id as bill_id,
  pb.portfolio_id,
  pb.vendor_id,
  v.name as vendor_name,
  v.address_street, v.address_city, v.address_state, v.address_zip,
  pb.association_id,
  a.name as association_name,
  pb.amount,
  pb.bill_date,
  pb.due_date,
  pb.memo,
  pb.gl_account_id,
  pb.bank_account_id,
  (current_date - pb.due_date) as days_past_due
from public.payable_bills pb
join public.vendors v on v.id = pb.vendor_id
left join public.associations a on a.id = pb.association_id
where pb.archived_at is null
  and pb.status = 'approved'
  and pb.paid_at is null
  and v.payment_type = 'check'
  and not v.is_auto_pay
order by pb.due_date, v.name;

comment on view public.v_check_writing_queue is 'Bills awaiting check-writing: approved, unpaid, vendor pays by check, not auto-pay. Used by the weekly check run UI.';

-- RPC to mark a batch of bills as paid with a single check run (assigns check numbers)
create or replace function public.record_check_run(
  p_bank_account_id uuid,
  p_bill_ids uuid[],
  p_starting_check_number integer,
  p_payment_date date default current_date
)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  bill_id uuid;
  idx integer := 0;
  bank_row public.bank_accounts;
  results jsonb := '[]'::jsonb;
begin
  select * into bank_row from public.bank_accounts where id = p_bank_account_id for update;
  if not found then raise exception 'bank account not found'; end if;

  if not public.can_manage_finance(bank_row.portfolio_id) then
    raise exception 'permission denied';
  end if;

  foreach bill_id in array p_bill_ids loop
    update public.payable_bills
       set status = 'paid'::public.payable_bill_status,
           paid_at = p_payment_date::timestamptz,
           bank_account_id = p_bank_account_id,
           bill_number = coalesce(bill_number, (p_starting_check_number + idx)::text),
           updated_at = now()
     where id = bill_id
       and public.can_manage_finance(portfolio_id);
    if found then
      results := results || jsonb_build_object(
        'bill_id', bill_id,
        'check_number', p_starting_check_number + idx
      );
      idx := idx + 1;
    end if;
  end loop;

  -- Advance bank_accounts.next_check_number
  update public.bank_accounts
     set next_check_number = p_starting_check_number + idx,
         updated_at = now()
   where id = p_bank_account_id;

  return jsonb_build_object(
    'checks_written', idx,
    'starting_check_number', p_starting_check_number,
    'next_check_number', p_starting_check_number + idx,
    'results', results
  );
end;
$$;

grant execute on function public.record_check_run(uuid, uuid[], integer, date) to authenticated;

-- -----------------------------------------------------------------------------
-- 10. Reverse-payment helper (undo an incorrect application)
-- -----------------------------------------------------------------------------
create or replace function public.unapply_payment(p_payment_id uuid, p_charge_id uuid default null)
returns integer
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare n integer;
begin
  if p_charge_id is null then
    -- Remove ALL applications for this payment
    delete from public.payment_applications where payment_id = p_payment_id;
  else
    delete from public.payment_applications where payment_id = p_payment_id and charge_id = p_charge_id;
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.unapply_payment(uuid, uuid) to authenticated;
;
