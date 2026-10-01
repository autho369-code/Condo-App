-- Calendar "notify maintenance" and "notify by SMS" never delivered:
-- * dispatch_calendar_maintenance_notify called dispatch_webhook with a
--   signature that does not exist, and as an AFTER trigger its error
--   (NEW.maintenance_notify_error := ...) was discarded.
-- * queue_calendar_sms texted the maintenance phone without consent (the
--   SMS worker only sends to opted-in numbers, so it sat queued forever),
--   did not normalize the number, fell back to a placeholder sender, and
--   matched conversations across companies.
-- Maintenance notices are now emailed to the association's maintenance
-- contact (or the company support address); SMS requires consent in the same
-- company. Both record success or the reason on the event.

create or replace function public.dispatch_calendar_maintenance_notify()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_to text;
  v_to_name text;
  v_assoc_name text;
  v_company text;
  v_reply text;
  v_tz text;
  v_when text;
  v_key text := 'calendar-maintenance:' || new.id::text;
begin
  if not coalesce(new.notify_maintenance, false) or new.maintenance_notified_at is not null then
    return new;
  end if;
  begin
    select nullif(btrim(a.maintenance_contact_email), ''), a.maintenance_contact_name, a.name,
           coalesce(nullif(a.timezone, ''), 'America/Chicago')
      into v_to, v_to_name, v_assoc_name, v_tz
      from public.associations a where a.id = new.association_id;
    select p.company_name, nullif(btrim(p.support_email), '') into v_company, v_reply
      from public.portfolios p where p.id = new.portfolio_id;
    v_to := coalesce(v_to, v_reply);
    if v_to is null then
      update public.calendar_events
         set maintenance_notify_error = 'No maintenance contact email on the association and no company support email'
       where id = new.id;
      return new;
    end if;
    v_when := to_char(new.start_datetime at time zone coalesce(v_tz, 'America/Chicago'), 'Dy Mon DD, YYYY FMHH12:MI AM');
    if not exists (select 1 from public.email_queue where idempotency_key = v_key) then
      insert into public.email_queue (to_email, to_name, subject, body, association_id, portfolio_id,
                                      status, from_address, from_name, reply_to, idempotency_key)
      values (
        v_to, v_to_name,
        '[' || coalesce(v_assoc_name, 'Association') || '] Maintenance: ' || left(new.title, 150),
        '<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;line-height:1.6;color:#111827">'
          || '<p><strong>' || public.html_escape(new.title) || '</strong></p>'
          || '<p>' || public.html_escape(coalesce(v_assoc_name, '')) || '<br>' || public.html_escape(coalesce(v_when, '')) || '</p>'
          || case when new.location is not null then '<p>Location: ' || public.html_escape(new.location) || '</p>' else '' end
          || case when new.maintenance_instructions is not null
                  then '<p style="white-space:pre-wrap">' || public.html_escape(new.maintenance_instructions) || '</p>' else '' end
          || '</div>',
        new.association_id, new.portfolio_id, 'pending',
        'maintenance@portier369.com', coalesce(v_company, 'Portier369'), v_reply, v_key);
    end if;
    update public.calendar_events
       set maintenance_notified_at = now(), maintenance_notify_error = null
     where id = new.id;
  exception when others then
    update public.calendar_events set maintenance_notify_error = left(sqlerrm, 500) where id = new.id;
  end;
  return new;
end
$function$;

create or replace function public.queue_calendar_sms(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  ev record;
  v_digits text;
  their_number text;
  convo_id uuid;
  msg_id uuid;
  msg_body text;
begin
  select ce.id, ce.title, ce.start_datetime, ce.location, ce.maintenance_instructions, ce.portfolio_id,
         a.id as assoc_id, a.name as assoc_name, coalesce(nullif(a.timezone, ''), 'America/Chicago') as tz,
         a.maintenance_contact_phone, a.maintenance_contact_name,
         nullif(btrim(p.texting_phone_number), '') as our_number
    into ev
    from public.calendar_events ce
    left join public.associations a on a.id = ce.association_id
    left join public.portfolios p on p.id = ce.portfolio_id
   where ce.id = p_event_id;

  if ev.maintenance_contact_phone is null then
    update public.calendar_events set sms_notify_error = 'No maintenance contact phone on the association' where id = p_event_id;
    return null;
  end if;
  if ev.our_number is null then
    update public.calendar_events set sms_notify_error = 'Texting is not set up for this company (no texting phone number)' where id = p_event_id;
    return null;
  end if;

  -- E.164: 10 digits -> +1XXXXXXXXXX, 11 digits starting with 1 -> +1...
  v_digits := regexp_replace(ev.maintenance_contact_phone, '\D', '', 'g');
  their_number := case
    when length(v_digits) = 10 then '+1' || v_digits
    when length(v_digits) = 11 and left(v_digits, 1) = '1' then '+' || v_digits
    when left(btrim(ev.maintenance_contact_phone), 1) = '+' then '+' || v_digits
    else null end;
  if their_number is null then
    update public.calendar_events set sms_notify_error = 'The maintenance contact phone is not a valid number' where id = p_event_id;
    return null;
  end if;

  if not exists (select 1 from public.sms_opt_ins o
                  where o.portfolio_id = ev.portfolio_id and o.phone_number = their_number and o.opted_in) then
    update public.calendar_events
       set sms_notify_error = 'The maintenance contact has not agreed to receive texts from this company'
     where id = p_event_id;
    return null;
  end if;

  select id into convo_id from public.sms_conversations
   where portfolio_id = ev.portfolio_id and with_phone_number = their_number and our_phone_number = ev.our_number
   limit 1;
  if convo_id is null then
    insert into public.sms_conversations
      (portfolio_id, association_id, with_entity_type, with_entity_id, with_name, with_phone_number, our_phone_number)
    values (ev.portfolio_id, ev.assoc_id, 'maintenance', ev.assoc_id,
            coalesce(ev.maintenance_contact_name, 'Maintenance'), their_number, ev.our_number)
    returning id into convo_id;
  end if;

  msg_body := '[' || coalesce(ev.assoc_name, 'Association') || '] ' || ev.title
              || E'\n' || to_char(ev.start_datetime at time zone ev.tz, 'Mon DD, FMHH12:MI AM')
              || case when ev.location is not null then ' @ ' || ev.location else '' end
              || case when ev.maintenance_instructions is not null then E'\n' || ev.maintenance_instructions else '' end;

  insert into public.sms_messages (conversation_id, direction, body, from_number, to_number, status, provider)
  values (convo_id, 'outbound', left(msg_body, 1600), ev.our_number, their_number, 'queued', 'pending')
  returning id into msg_id;

  update public.calendar_events set sms_notified_at = now(), sms_notify_error = null where id = p_event_id;
  return msg_id;
end;
$function$;

create or replace function public.dispatch_calendar_sms_notify()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.notify_sms = true and new.sms_notified_at is null then
    begin
      perform public.queue_calendar_sms(new.id);
    exception when others then
      -- AFTER trigger: assigning NEW does nothing; record the error on the row.
      update public.calendar_events set sms_notify_error = left(sqlerrm, 500) where id = new.id;
    end;
  end if;
  return new;
end
$function$;
