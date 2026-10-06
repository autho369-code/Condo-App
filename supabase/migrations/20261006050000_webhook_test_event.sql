-- "Send test event" for webhook endpoints: a company admin can queue a signed
-- 'ping' delivery to one of their endpoints, through the same queue, signing
-- and retry path as real events, to confirm the endpoint and its signature
-- check work before relying on live events. 'ping' is not a subscribable
-- business event (it is never dispatched by triggers).

alter type public.webhook_event add value if not exists 'ping';

create or replace function public.send_test_webhook(p_endpoint_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  endpoint_row public.webhook_endpoints;
  delivery_id uuid;
begin
  select * into endpoint_row from public.webhook_endpoints where id = p_endpoint_id;
  if not found or not public.can_admin_portfolio(endpoint_row.portfolio_id) then
    raise exception 'Webhook endpoint not found.' using errcode = '42501';
  end if;
  if not public.has_entitlement(endpoint_row.portfolio_id, 'webhooks') then
    raise exception 'Webhooks are not enabled for this portfolio.' using errcode = '42501';
  end if;
  if not endpoint_row.active or (endpoint_row.disabled_until is not null and endpoint_row.disabled_until > now()) then
    raise exception 'Enable this endpoint before sending a test event.' using errcode = '22023';
  end if;
  -- One test per endpoint per minute. Lock the endpoint row first (only after
  -- the access checks) so overlapping calls wait and can't both pass.
  perform 1 from public.webhook_endpoints where id = endpoint_row.id for update;
  perform 1 from public.webhook_deliveries
   where endpoint_id = endpoint_row.id
     and event_type = 'ping'::public.webhook_event
     and created_at > now() - interval '1 minute';
  if found then
    raise exception 'A test event was sent to this endpoint less than a minute ago.' using errcode = '22023';
  end if;

  insert into public.webhook_deliveries (endpoint_id, event_type, payload)
  values (
    endpoint_row.id,
    'ping'::public.webhook_event,
    jsonb_build_object(
      'type', 'ping',
      'test', true,
      'message', 'Test event from your property management platform. No action needed.',
      'endpoint_id', endpoint_row.id,
      'portfolio_id', endpoint_row.portfolio_id,
      'sent_at', now()
    )
  )
  returning id into delivery_id;
  return delivery_id;
end;
$function$;

revoke execute on function public.send_test_webhook(uuid) from public, anon;
grant execute on function public.send_test_webhook(uuid) to authenticated;
