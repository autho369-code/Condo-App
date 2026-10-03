-- Follow-up to 20261003070000 (review fixes):
-- 1. A reversal credits the cash account the original receipt actually
--    debited (from its posted journal lines), not today's bank mapping, so a
--    receipt whose bank account was later changed or removed reverses out of
--    the right account. The current mapping is only a fallback.
-- 2. unapply_payment is revoked from PUBLIC too (functions grant EXECUTE to
--    PUBLIC by default, so revoking only from authenticated did nothing).

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

  -- The account the receipt's own posting debited (net of any reposting).
  select jl.gl_account_id into v_cash
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id
   where je.source_type = 'payment' and je.source_id = pay.id and je.posted
   group by jl.gl_account_id
  having sum(jl.debit_amount - jl.credit_amount) > 0
   order by sum(jl.debit_amount - jl.credit_amount) desc
   limit 1;
  if v_cash is null then
    select g.cash into v_cash from public.payment_gl_accounts(pay) g;
  end if;
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

revoke all on function public.reverse_homeowner_payment(uuid, text, date, boolean) from public, anon;
grant execute on function public.reverse_homeowner_payment(uuid, text, date, boolean) to authenticated;
revoke all on function public.unapply_payment(uuid, uuid) from public, anon, authenticated;
