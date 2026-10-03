-- Homeowner receipts: reallocate a payment across charges, and reverse a
-- returned payment (NSF / bounced check / chargeback).
--
-- Reallocating replaces the payment's applications in one transaction, so a
-- paid charge never sits "open" in between (the old Unapply button left the
-- money unapplied with no way to re-apply it, and late fees could hit the
-- reopened charge).
--
-- Reversing keeps the original receipt (it was received and deposited) and
-- posts a "Returned payment" charge for the same amount, credited to the cash
-- account the receipt debited: Dr A/R, Cr Cash on the reversal date. The
-- receipt is moved onto that charge, so the charges it had paid are open again
-- and the owner's balance goes back up. Every balance, aging, ledger and
-- report that sums charges and payments stays correct without special cases.

alter table public.payments
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references auth.users(id) on delete set null,
  add column if not exists reversal_reason text,
  add column if not exists reversal_charge_id uuid references public.charges(id) on delete set null;

comment on column public.payments.reversed_at is 'Set when the receipt was reversed (returned / NSF). The reversal is the charge in reversal_charge_id.';

-- ── Reallocate ───────────────────────────────────────────────
create or replace function public.reallocate_payment(p_payment_id uuid, p_allocations jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  pay public.payments;
  v_assoc uuid;
  v_pid uuid;
  a record;
  v_charge record;
  v_open numeric(14,2);
  v_total numeric(14,2) := 0;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  v_assoc := public.unit_association_id(pay.unit_id);
  select portfolio_id into v_pid from public.associations where id = v_assoc;
  if v_pid is null or not public.can_manage_finance(v_pid) or not public.can_manage_association(v_assoc) then
    raise exception 'You do not have accounting access to this association' using errcode = '42501';
  end if;
  if pay.reversed_at is not null then
    raise exception 'This payment was reversed and cannot be reallocated' using errcode = '22023';
  end if;
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'Allocations must be a list' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('unit-apply:' || pay.unit_id::text, 0));
  delete from public.payment_applications where payment_id = p_payment_id;

  for a in
    select (x->>'charge_id')::uuid as charge_id, round(sum((x->>'amount')::numeric), 2) as amount
      from jsonb_array_elements(p_allocations) x
     where nullif(x->>'charge_id', '') is not null and coalesce((x->>'amount')::numeric, 0) > 0
     group by 1
  loop
    select c.id, c.unit_id, c.amount, c.description into v_charge from public.charges c where c.id = a.charge_id for update;
    if not found or v_charge.unit_id is distinct from pay.unit_id then
      raise exception 'A selected charge is not on this unit' using errcode = '23514';
    end if;
    v_open := v_charge.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = a.charge_id), 0);
    if a.amount > v_open then
      raise exception 'Applying % to "%" is more than its open balance (%)', a.amount, coalesce(v_charge.description, 'charge'), v_open using errcode = '23514';
    end if;
    v_total := v_total + a.amount;
    if v_total > pay.amount then
      raise exception 'The allocations (%) are more than the payment (%)', v_total, pay.amount using errcode = '23514';
    end if;
    insert into public.payment_applications (payment_id, charge_id, amount_applied, applied_by, application_method)
    values (p_payment_id, a.charge_id, a.amount, auth.uid(), 'manual');
  end loop;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'payment', p_payment_id, 'payment_reallocated', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('allocations', p_allocations, 'applied', v_total));

  return jsonb_build_object('applied', v_total, 'unapplied', pay.amount - v_total);
end
$function$;

-- ── Reverse (returned payment) ───────────────────────────────
create or replace function public.reverse_homeowner_payment(
  p_payment_id uuid,
  p_reason text,
  p_reversal_date date default null,
  p_charge_nsf_fee boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  pay public.payments;
  v_assoc uuid;
  v_pid uuid;
  v_cash uuid;
  v_date date;
  v_reason text := left(btrim(coalesce(p_reason, '')), 200);
  v_charge_id uuid;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  v_assoc := public.unit_association_id(pay.unit_id);
  select portfolio_id into v_pid from public.associations where id = v_assoc;
  if v_pid is null or not public.can_manage_finance(v_pid) or not public.can_manage_association(v_assoc) then
    raise exception 'You do not have accounting access to this association' using errcode = '42501';
  end if;
  if pay.method = 'credit' then
    raise exception 'A credit is not a payment; it cannot be reversed as returned' using errcode = '22023';
  end if;
  if pay.reversed_at is not null then
    raise exception 'This payment was already reversed' using errcode = '22023';
  end if;
  if v_reason = '' then
    raise exception 'Enter why the payment was returned' using errcode = '22023';
  end if;
  v_date := coalesce(p_reversal_date, public.association_local_date(v_assoc));
  if v_date < pay.payment_date then
    raise exception 'The reversal date cannot be before the payment date (%)', pay.payment_date using errcode = '22023';
  end if;

  select g.cash into v_cash from public.payment_gl_accounts(pay) g;
  if v_cash is null then
    raise exception 'No cash account found for this payment' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('unit-apply:' || pay.unit_id::text, 0));
  -- The charges this payment paid are open again.
  delete from public.payment_applications where payment_id = p_payment_id;

  -- Dr A/R, Cr the receipt's cash account, on the reversal date.
  insert into public.charges (unit_id, charge_type, description, amount, due_date, gl_account_id, created_by)
  values (pay.unit_id, 'other',
          left(format('Returned payment%s: %s', coalesce(' ' || nullif(pay.reference, ''), ''), v_reason), 500),
          pay.amount, v_date, v_cash, auth.uid())
  returning id into v_charge_id;

  -- The returned receipt settles its own reversal charge (and nothing else);
  -- undo any credit the new-charge trigger applied to it.
  delete from public.payment_applications where charge_id = v_charge_id;
  insert into public.payment_applications (payment_id, charge_id, amount_applied, applied_by, application_method)
  values (p_payment_id, v_charge_id, pay.amount, auth.uid(), 'manual');

  update public.payments
     set reversed_at = now(), reversed_by = auth.uid(), reversal_reason = v_reason, reversal_charge_id = v_charge_id
   where id = p_payment_id;

  if p_charge_nsf_fee then
    perform public.post_nsf_fee(p_payment_id, 'NSF fee: returned payment');
  end if;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'payment', p_payment_id, 'payment_reversed', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('amount', pay.amount, 'reason', v_reason, 'reversal_date', v_date,
                             'reversal_charge_id', v_charge_id, 'nsf_fee', p_charge_nsf_fee));
  return v_charge_id;
end
$function$;

revoke all on function public.reallocate_payment(uuid, jsonb) from public, anon;
revoke all on function public.reverse_homeowner_payment(uuid, text, date, boolean) from public, anon;
grant execute on function public.reallocate_payment(uuid, jsonb) to authenticated;
grant execute on function public.reverse_homeowner_payment(uuid, text, date, boolean) to authenticated;

-- Unapply-only left charges open with no way back; reallocate replaces it.
revoke execute on function public.unapply_payment(uuid, uuid) from authenticated;

-- Late fees were only assessed when someone clicked "Charge late fees now".
-- Assess them daily for associations whose late-fee policy is on.
select cron.schedule('assess-late-fees-daily', '10 7 * * *',
  $$ select public.cron_assess_late_fees(); $$);
