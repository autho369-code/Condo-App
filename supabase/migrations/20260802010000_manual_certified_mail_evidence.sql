-- Keep the delinquency ladder operable while provider fulfillment is disabled.
-- Only a portfolio administrator may attest to delivery, and every attestation
-- carries tracking, a delivery date, a written rationale, and an audit event.

alter table public.physical_mail_deliveries
  add column if not exists delivery_verified_by uuid references auth.users(id) on delete set null,
  add column if not exists delivery_verified_at timestamptz,
  add column if not exists manual_delivery_note text;

create or replace function public.record_manual_certified_mail_delivery(
  p_id uuid,
  p_tracking_number text,
  p_delivered_on date,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  mail public.physical_mail_deliveries%rowtype;
  tracking text := upper(regexp_replace(btrim(coalesce(p_tracking_number, '')), '\s+', '', 'g'));
  evidence_note text := btrim(coalesce(p_note, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into mail
  from public.physical_mail_deliveries
  where id = p_id
  for update;

  if mail.id is null then
    raise exception 'Physical-mail record not found';
  end if;
  if not (public.can_admin_portfolio(mail.portfolio_id) or public.is_platform_operator()) then
    raise exception 'Portfolio administrator access required';
  end if;
  if mail.delinquency_case_id is null then
    raise exception 'Manual delivery evidence is limited to a delinquency case';
  end if;
  if mail.status = 'delivered' then
    raise exception 'Delivery is already confirmed';
  end if;
  if tracking !~ '^[A-Z0-9-]{8,40}$' then
    raise exception 'Enter a valid certified-mail tracking number';
  end if;
  if p_delivered_on is null or p_delivered_on > current_date then
    raise exception 'Delivery date must be today or earlier';
  end if;
  if char_length(evidence_note) < 20 then
    raise exception 'Delivery evidence note must be at least 20 characters';
  end if;

  update public.physical_mail_deliveries
  set status = 'delivered',
      provider = 'manual_usps',
      provider_piece_id = tracking,
      provider_url = null,
      expected_delivery_date = p_delivered_on,
      delivered_at = p_delivered_on::timestamp at time zone 'UTC',
      delivery_verified_by = auth.uid(),
      delivery_verified_at = now(),
      manual_delivery_note = left(evidence_note, 2000),
      last_status_at = now(),
      locked_at = null,
      error_message = null
  where id = p_id;

  insert into public.audit_logs (entity_type, entity_id, action, actor_id, changes)
  values (
    'physical_mail_delivery',
    p_id,
    'manual_certified_mail_delivery_recorded',
    auth.uid(),
    jsonb_build_object(
      'portfolio_id', mail.portfolio_id,
      'association_id', mail.association_id,
      'delinquency_case_id', mail.delinquency_case_id,
      'tracking_number', tracking,
      'delivered_on', p_delivered_on,
      'note', left(evidence_note, 2000)
    )
  );

  return jsonb_build_object('success', true, 'status', 'delivered');
end;
$$;

revoke all on function public.record_manual_certified_mail_delivery(uuid, text, date, text)
  from public, anon;
grant execute on function public.record_manual_certified_mail_delivery(uuid, text, date, text)
  to authenticated, service_role;
