-- Make Stripe-to-ledger posting safe under concurrent webhook retries.
-- The live database contained no Stripe-referenced payments or payment intents
-- when this migration was prepared on 2026-07-26.

create unique index if not exists payments_stripe_reference_unique
  on public.payments (reference)
  where reference ~ '^pi_';

create or replace function public.post_stripe_ledger_payment(
  p_intent_id uuid,
  p_method text,
  p_processor_payment_intent_id text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_intent public.payment_intents%rowtype;
  v_payment_id uuid;
begin
  if p_method not in ('card', 'ach') then
    raise exception 'Unsupported Stripe payment method';
  end if;
  if p_processor_payment_intent_id is null
     or p_processor_payment_intent_id !~ '^pi_' then
    raise exception 'Invalid Stripe PaymentIntent id';
  end if;

  select * into v_intent
  from public.payment_intents
  where id = p_intent_id
  for update;

  if not found then
    raise exception 'Payment intent not found';
  end if;
  if v_intent.payment_id is not null then
    return v_intent.payment_id;
  end if;

  insert into public.payments (
    unit_id,
    amount,
    payment_date,
    method,
    reference,
    notes
  ) values (
    v_intent.unit_id,
    v_intent.amount,
    current_date,
    p_method,
    p_processor_payment_intent_id,
    format('Online payment via Stripe (%s)', p_method)
  )
  on conflict (reference) where reference ~ '^pi_'
  do nothing
  returning id into v_payment_id;

  if v_payment_id is null then
    select id into v_payment_id
    from public.payments
    where reference = p_processor_payment_intent_id;
  end if;

  if v_payment_id is null then
    raise exception 'Could not resolve Stripe ledger payment';
  end if;

  update public.payment_intents
  set payment_id = v_payment_id,
      updated_at = now()
  where id = v_intent.id;

  return v_payment_id;
end;
$function$;

revoke all on function public.post_stripe_ledger_payment(uuid, text, text) from public;
revoke all on function public.post_stripe_ledger_payment(uuid, text, text) from anon;
revoke all on function public.post_stripe_ledger_payment(uuid, text, text) from authenticated;
grant execute on function public.post_stripe_ledger_payment(uuid, text, text) to service_role;
