-- Communication Center "Retry" never resent anything. A message is marked
-- failed only after its email_queue rows reach attempt_count >= 5, and
-- claim_email_queue skips rows at 5 attempts. On retry, the insert hit the
-- idempotency key and did nothing, the message flipped to 'queued', and it
-- stayed there forever.
-- Now an existing row for the same recipient is re-armed when (and only
-- when) it failed; rows that were sent are never resent.
create or replace function public.enqueue_communication_message(p_message_id uuid, p_recipients jsonb, p_html text, p_from_name text default 'Portier369'::text)
 returns integer
 language plpgsql
 set search_path to ''
as $function$
declare
  v_message public.communication_messages%rowtype;
  v_recipient jsonb;
  v_email text;
  v_name text;
  v_count integer := 0;
begin
  if not (public.is_staff() or public.is_platform_operator()) then
    raise exception 'Staff access required';
  end if;

  select * into v_message
  from public.communication_messages
  where id = p_message_id
  for update;

  if not found then raise exception 'Message not found or unavailable'; end if;
  if v_message.channel <> 'email' then raise exception 'Only email messages may be queued'; end if;
  if v_message.status in ('queued', 'sent') then
    select count(*) into v_count from public.email_queue where communication_message_id = p_message_id;
    return v_count;
  end if;
  if coalesce(length(v_message.subject), 0) < 1 or length(v_message.subject) > 300 then
    raise exception 'Message subject length is invalid';
  end if;
  if coalesce(length(v_message.body), 0) < 1 or length(v_message.body) > 50000 then
    raise exception 'Message body length is invalid';
  end if;
  if jsonb_typeof(p_recipients) <> 'array' or jsonb_array_length(p_recipients) < 1
     or jsonb_array_length(p_recipients) > 500 then
    raise exception 'Recipient count must be between 1 and 500';
  end if;
  if coalesce(length(p_html), 0) < 1 or length(p_html) > 200000 then
    raise exception 'Rendered message length is invalid';
  end if;

  for v_recipient in select value from jsonb_array_elements(p_recipients)
  loop
    v_email := lower(trim(v_recipient ->> 'email'));
    v_name := nullif(trim(v_recipient ->> 'name'), '');
    if length(v_email) > 320 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'Invalid recipient email address';
    end if;

    insert into public.email_queue (
      to_email, to_name, subject, body, association_id, portfolio_id,
      sent_by, status, from_address, from_name, reply_to,
      communication_message_id, idempotency_key
    ) values (
      v_email, v_name, v_message.subject, p_html, v_message.association_id,
      v_message.portfolio_id, auth.uid(), 'pending', 'hello@portier369.com',
      left(coalesce(nullif(trim(p_from_name), ''), 'Portier369'), 200),
      'hello@portier369.com', p_message_id,
      'communication:' || p_message_id::text || ':' || v_email
    )
    on conflict (idempotency_key) do update
      set status = 'pending',
          attempt_count = 0,
          next_attempt_at = now(),
          processing_at = null,
          error_message = null
      where public.email_queue.status = 'failed';

    if found then v_count := v_count + 1; end if;
  end loop;

  update public.communication_messages
  set status = 'queued', queued_at = now(), error_message = null, updated_at = now()
  where id = p_message_id;

  return v_count;
end;
$function$;
