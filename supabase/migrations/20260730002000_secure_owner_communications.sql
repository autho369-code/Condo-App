-- Make owner-to-management messaging atomic, tenant-derived, idempotent, and
-- durably rate limited. No service-role client is required in the web action.
alter table public.communications_log
  add column if not exists body text,
  add column if not exists idempotency_key uuid;

alter table public.email_queue
  add column if not exists communication_log_id uuid references public.communications_log(id) on delete set null;

create index if not exists email_queue_communication_log_idx
  on public.email_queue (communication_log_id)
  where communication_log_id is not null;

create unique index if not exists communications_log_sender_idempotency_unique
  on public.communications_log (sender_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.submit_owner_message(
  p_subject text,
  p_body text,
  p_idempotency_key uuid
) returns uuid
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  owner_row public.owners%rowtype;
  occupancy_row record;
  sender_name text;
  sender_email text;
  existing_id uuid;
  message_id uuid;
  recipient record;
  v_recipient_count integer := 0;
  safe_body text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_idempotency_key is null then raise exception 'Message request key is required'; end if;
  p_subject := btrim(coalesce(p_subject, ''));
  p_body := btrim(coalesce(p_body, ''));
  if length(p_subject) < 2 or length(p_subject) > 200 then
    raise exception 'Subject must be between 2 and 200 characters';
  end if;
  if length(p_body) < 2 or length(p_body) > 10000 then
    raise exception 'Message must be between 2 and 10,000 characters';
  end if;

  select * into owner_row from public.owners
   where auth_user_id = auth.uid()
     and portal_activated
     and archived_at is null
   order by created_at, id
   limit 1;
  if not found then raise exception 'Active owner portal access is required'; end if;

  select oc.association_id, oc.unit_id, a.portfolio_id, u.unit_number
    into occupancy_row
    from public.occupancies oc
    join public.associations a on a.id = oc.association_id and a.archived_at is null
    join public.units u on u.id = oc.unit_id
   where oc.owner_id = owner_row.id
     and oc.occupancy_type = 'owner'
     and oc.status = 'current'
   order by oc.created_at, oc.id
   limit 1;
  if not found then raise exception 'No active association occupancy was found'; end if;

  select id into existing_id from public.communications_log
   where sender_id = auth.uid() and idempotency_key = p_idempotency_key;
  if existing_id is not null then return existing_id; end if;

  if (
    select count(*) from public.communications_log
     where sender_id = auth.uid()
       and direction = 'inbound'
       and created_at >= now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Message limit reached. Please wait before sending another message';
  end if;

  select coalesce(nullif(full_name, ''), nullif(email, ''), 'A homeowner'), email
    into sender_name, sender_email
    from public.profiles where id = auth.uid();
  sender_name := coalesce(sender_name, 'A homeowner');
  safe_body := replace(replace(replace(p_body, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

  insert into public.communications_log (
    portfolio_id, association_id, sender_id, direction, channel,
    recipient_count, status, subject, body, idempotency_key
  ) values (
    occupancy_row.portfolio_id, occupancy_row.association_id, auth.uid(),
    'inbound', 'email', 0, 'sent', p_subject, p_body, p_idempotency_key
  ) returning id into message_id;

  for recipient in
    with candidates as (
      select p.email, p.full_name as name, 1 as priority
        from public.associations a
        join public.profiles p on p.id = a.site_manager_user_id
       where a.id = occupancy_row.association_id and nullif(btrim(p.email), '') is not null
      union all
      select p.email, p.full_name, 2
        from public.profiles p
       where p.portfolio_id = occupancy_row.portfolio_id
         and p.hoa_role = 'company_admin'
         and nullif(btrim(p.email), '') is not null
      union all
      select p.support_email, p.company_name, 3
        from public.portfolios p
       where p.id = occupancy_row.portfolio_id
         and nullif(btrim(p.support_email), '') is not null
    ), selected as (
      select * from candidates where priority = (select min(priority) from candidates)
    )
    select distinct on (lower(email)) email, name from selected order by lower(email)
  loop
    insert into public.email_queue (
      to_email, to_name, subject, body, association_id, portfolio_id,
      sent_by, status, from_address, from_name, reply_to, communication_log_id
    ) values (
      recipient.email, recipient.name, '[Owner message] ' || p_subject,
      '<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;white-space:pre-wrap;line-height:1.6;color:#111827">'
        || 'New message from ' || sender_name
        || case when occupancy_row.unit_number is null then '' else ' (Unit ' || occupancy_row.unit_number || ')' end
        || ' via the owner portal.' || E'\n\n' || safe_body || E'\n\n— Sent by ' || sender_name
        || case when sender_email is null then '' else ' &lt;' || sender_email || '&gt;' end || '</div>',
      occupancy_row.association_id, occupancy_row.portfolio_id,
      auth.uid(), 'pending', 'hello@portier369.com', 'Portier369', sender_email, message_id
    );
    v_recipient_count := v_recipient_count + 1;
  end loop;

  if v_recipient_count = 0 then
    raise exception 'No management email recipient is configured for this association';
  end if;
  update public.communications_log set recipient_count = v_recipient_count
   where id = message_id;
  return message_id;
end;
$$;

alter function public.submit_owner_message(text, text, uuid) owner to postgres;
revoke all on function public.submit_owner_message(text, text, uuid) from public, anon;
grant execute on function public.submit_owner_message(text, text, uuid) to authenticated, service_role;

drop policy if exists communications_resident_read on public.communications_log;
create policy communications_resident_read on public.communications_log
  for select to authenticated
  using (
    public.is_portal_resident()
    and (
      sender_id = auth.uid()
      or (
        channel = 'announcement'
        and association_id in (select public.current_resident_association_ids())
      )
    )
  );
