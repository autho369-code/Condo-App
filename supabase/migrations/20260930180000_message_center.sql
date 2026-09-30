-- Secure resident <-> management messaging.
--
-- Residents had no way to simply ask management something, so questions
-- arrived as maintenance requests (ledger copies, minutes, insurance pages…).
-- A message thread belongs to one resident party — an owner OR a tenant — at
-- one association (optionally one unit). Residents start and reply to their
-- own threads; staff reply, leave internal notes residents never see, assign a
-- teammate, and close/reopen. Every write goes through the functions below;
-- the tables have no write policies. New resident messages carry the same
-- first-response clock as service requests and email the assigned teammate
-- (else the association's managers, else every company manager, plus the
-- support inbox); staff replies email the resident.

create table if not exists public.message_threads (
  id                    uuid primary key default gen_random_uuid(),
  portfolio_id          uuid not null references public.portfolios(id) on delete cascade,
  association_id        uuid not null references public.associations(id) on delete cascade,
  unit_id               uuid references public.units(id) on delete set null,
  owner_id              uuid references public.owners(id) on delete cascade,
  tenant_id             uuid references public.tenants(id) on delete cascade,
  subject               text not null check (length(btrim(subject)) between 1 and 150),
  status                text not null default 'open' check (status in ('open', 'closed')),
  assigned_to           uuid references public.profiles(id) on delete set null,
  started_by_role       text not null check (started_by_role in ('resident', 'staff')),
  created_by            uuid,
  created_at            timestamptz not null default now(),
  last_message_at       timestamptz not null default now(),
  last_message_preview  text,
  last_message_role     text check (last_message_role in ('resident', 'staff')),
  resident_unread       boolean not null default false,
  staff_unread          boolean not null default false,
  first_response_due_at timestamptz,
  acknowledged_at       timestamptz,
  closed_at             timestamptz,
  check ((owner_id is null) <> (tenant_id is null))
);
create index if not exists message_threads_staff_idx on public.message_threads (portfolio_id, status, last_message_at desc);
create index if not exists message_threads_owner_idx on public.message_threads (owner_id, last_message_at desc) where owner_id is not null;
create index if not exists message_threads_tenant_idx on public.message_threads (tenant_id, last_message_at desc) where tenant_id is not null;

create table if not exists public.message_thread_messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references public.message_threads(id) on delete cascade,
  author_id    uuid,
  author_role  text not null check (author_role in ('resident', 'staff')),
  author_name  text,
  body         text not null check (length(btrim(body)) between 1 and 5000),
  internal     boolean not null default false,
  created_at   timestamptz not null default now(),
  check (not internal or author_role = 'staff')
);
create index if not exists message_thread_messages_thread_idx on public.message_thread_messages (thread_id, created_at);

alter table public.message_threads enable row level security;
alter table public.message_thread_messages enable row level security;

create or replace function public.is_messaging_staff()
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.is_platform_operator() or public.is_any_staff() or public.is_company_admin();
$$;

drop policy if exists message_threads_staff_read on public.message_threads;
create policy message_threads_staff_read on public.message_threads for select to authenticated
  using (public.is_messaging_staff() and public.can_access_portfolio(portfolio_id));
drop policy if exists message_threads_resident_read on public.message_threads;
create policy message_threads_resident_read on public.message_threads for select to authenticated
  using ((message_threads.owner_id is not null and message_threads.owner_id = public.current_owner_id())
         or (message_threads.tenant_id is not null and message_threads.tenant_id in (select public.current_tenant_ids())));
drop policy if exists mgr_assoc_scope on public.message_threads;
create policy mgr_assoc_scope on public.message_threads as restrictive for all to authenticated
  using (public.can_view_association_row(association_id));

drop policy if exists message_thread_messages_read on public.message_thread_messages;
create policy message_thread_messages_read on public.message_thread_messages for select to authenticated
  using (exists (select 1 from public.message_threads t where t.id = message_thread_messages.thread_id)
         and (not message_thread_messages.internal or public.is_messaging_staff()));

revoke insert, update, delete on public.message_threads, public.message_thread_messages from anon, authenticated;
grant select on public.message_threads, public.message_thread_messages to authenticated;

-- Who is the caller for this thread? Locks the thread row.
create or replace function public.message_thread_access(p_thread uuid, out role text, out thread public.message_threads)
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into thread from public.message_threads where id = p_thread for update;
  if not found then raise exception 'Conversation not found' using errcode = 'P0002'; end if;
  if public.is_messaging_staff() and public.can_access_portfolio(thread.portfolio_id)
     and public.can_manage_association(thread.association_id) then
    role := 'staff';
  elsif (thread.owner_id is not null and thread.owner_id = public.current_owner_id())
     or (thread.tenant_id is not null and thread.tenant_id in (select public.current_tenant_ids())) then
    role := 'resident';
  else
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
end $$;
revoke all on function public.message_thread_access(uuid) from public, anon, authenticated;

create or replace function public.message_author_name()
returns text language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.display_name), ''), p.email, 'Management')
    from public.profiles p where p.id = auth.uid();
$$;
revoke all on function public.message_author_name() from public, anon, authenticated;

-- Resident starts a conversation about one of their units.
create or replace function public.start_resident_message_thread(p_unit uuid, p_subject text, p_body text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_owner uuid; v_tenant uuid; v_assoc uuid; v_portfolio uuid; v_name text; v_id uuid; v_open int;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select b.association_id, a.portfolio_id into v_assoc, v_portfolio
    from public.units u join public.buildings b on b.id = u.building_id join public.associations a on a.id = b.association_id
   where u.id = p_unit;
  if v_assoc is null then raise exception 'Unit not found' using errcode = 'P0002'; end if;

  if public.current_owner_id() is not null and p_unit in (select public.current_resident_unit_ids()) then
    v_owner := public.current_owner_id();
    select full_name into v_name from public.owners where id = v_owner;
  else
    select t.id, btrim(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, '')) into v_tenant, v_name
      from public.tenants t
     where t.unit_id = p_unit and t.id in (select public.current_tenant_ids()) and t.archived_at is null
     limit 1;
    if v_tenant is null then raise exception 'Unit not found' using errcode = 'P0002'; end if;
  end if;

  select count(*) into v_open from public.message_threads
   where status = 'open' and (owner_id = v_owner or tenant_id = v_tenant);
  if v_open >= 25 then
    raise exception 'You have 25 open conversations — reply in one of those instead' using errcode = '22023';
  end if;

  insert into public.message_threads (portfolio_id, association_id, unit_id, owner_id, tenant_id, subject, started_by_role,
                                      created_by, staff_unread, first_response_due_at)
  values (v_portfolio, v_assoc, p_unit, v_owner, v_tenant, btrim(p_subject), 'resident', auth.uid(), true, now() + interval '48 hours')
  returning id into v_id;
  insert into public.message_thread_messages (thread_id, author_id, author_role, author_name, body)
  values (v_id, auth.uid(), 'resident', nullif(v_name, ''), btrim(p_body));
  return v_id;
end $$;

-- Staff start a conversation with an owner or a tenant.
create or replace function public.start_staff_message_thread(p_owner uuid, p_tenant uuid, p_subject text, p_body text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_assoc uuid; v_portfolio uuid; v_unit uuid; v_id uuid;
begin
  if auth.uid() is null or not public.is_messaging_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if (p_owner is null) = (p_tenant is null) then raise exception 'Pick one recipient' using errcode = '22023'; end if;
  if p_owner is not null then
    select b.association_id, a.portfolio_id, uo.unit_id into v_assoc, v_portfolio, v_unit
      from public.unit_owners uo join public.units u on u.id = uo.unit_id join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id
     where uo.owner_id = p_owner and uo.end_date is null
     order by uo.is_primary desc nulls last limit 1;
  else
    select t.association_id, t.portfolio_id, t.unit_id into v_assoc, v_portfolio, v_unit
      from public.tenants t where t.id = p_tenant and t.archived_at is null;
  end if;
  if v_assoc is null or not public.can_access_portfolio(v_portfolio) or not public.can_manage_association(v_assoc) then
    raise exception 'Recipient not found' using errcode = 'P0002';
  end if;
  insert into public.message_threads (portfolio_id, association_id, unit_id, owner_id, tenant_id, subject, started_by_role,
                                      created_by, resident_unread, assigned_to, acknowledged_at)
  values (v_portfolio, v_assoc, v_unit, p_owner, p_tenant, btrim(p_subject), 'staff', auth.uid(), true, auth.uid(), now())
  returning id into v_id;
  insert into public.message_thread_messages (thread_id, author_id, author_role, author_name, body)
  values (v_id, auth.uid(), 'staff', public.message_author_name(), btrim(p_body));
  return v_id;
end $$;

create or replace function public.post_message(p_thread uuid, p_body text, p_internal boolean default false)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare a record; v_id uuid; v_name text;
begin
  select * into a from public.message_thread_access(p_thread);
  if a.role = 'resident' then
    if coalesce(p_internal, false) then raise exception 'Not allowed' using errcode = '42501'; end if;
    if (a.thread).owner_id is not null then select full_name into v_name from public.owners where id = (a.thread).owner_id;
    else select btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) into v_name from public.tenants where id = (a.thread).tenant_id; end if;
    insert into public.message_thread_messages (thread_id, author_id, author_role, author_name, body)
    values (p_thread, auth.uid(), 'resident', nullif(v_name, ''), btrim(p_body)) returning id into v_id;
    update public.message_threads
       set staff_unread = true, status = 'open', closed_at = null,
           last_message_at = now(), last_message_preview = left(btrim(p_body), 140), last_message_role = 'resident',
           -- A new question after the last answer restarts the reply clock.
           first_response_due_at = case when acknowledged_at is null or last_message_role = 'staff'
                                        then now() + interval '48 hours' else first_response_due_at end,
           acknowledged_at = case when last_message_role = 'staff' then null else acknowledged_at end
     where id = p_thread;
  else
    insert into public.message_thread_messages (thread_id, author_id, author_role, author_name, body, internal)
    values (p_thread, auth.uid(), 'staff', public.message_author_name(), btrim(p_body), coalesce(p_internal, false)) returning id into v_id;
    if not coalesce(p_internal, false) then
      update public.message_threads
         set resident_unread = true, staff_unread = false,
             last_message_at = now(), last_message_preview = left(btrim(p_body), 140), last_message_role = 'staff',
             acknowledged_at = coalesce(acknowledged_at, now()),
             assigned_to = coalesce(assigned_to, auth.uid())
       where id = p_thread;
    end if;
  end if;
  return v_id;
end $$;

create or replace function public.set_message_thread_status(p_thread uuid, p_status text)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare a record;
begin
  select * into a from public.message_thread_access(p_thread);
  if a.role <> 'staff' then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_status not in ('open', 'closed') then raise exception 'Unknown status' using errcode = '22023'; end if;
  update public.message_threads
     set status = p_status, closed_at = case when p_status = 'closed' then now() end,
         staff_unread = case when p_status = 'closed' then false else staff_unread end
   where id = p_thread;
end $$;

create or replace function public.assign_message_thread(p_thread uuid, p_user uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare a record;
begin
  select * into a from public.message_thread_access(p_thread);
  if a.role <> 'staff' then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_user is not null and not exists (
       select 1 from public.profiles p
        where p.id = p_user and p.portfolio_id = (a.thread).portfolio_id and p.disabled_at is null
          and p.hoa_role in ('manager', 'company_admin')) then
    raise exception 'That person is not on your team' using errcode = '22023';
  end if;
  update public.message_threads set assigned_to = p_user where id = p_thread;
end $$;

create or replace function public.mark_message_thread_read(p_thread uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare a record;
begin
  select * into a from public.message_thread_access(p_thread);
  if a.role = 'staff' then update public.message_threads set staff_unread = false where id = p_thread;
  else update public.message_threads set resident_unread = false where id = p_thread; end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'start_resident_message_thread(uuid, text, text)', 'start_staff_message_thread(uuid, uuid, text, text)',
    'post_message(uuid, text, boolean)', 'set_message_thread_status(uuid, text)',
    'assign_message_thread(uuid, uuid)', 'mark_message_thread_read(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Email on every new non-internal message.
create or replace function public.message_notify()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  t public.message_threads; v_assoc text; v_company text; v_support text; v_to text; v_to_name text;
  v_text text; v_html text; r record;
begin
  if new.internal then return new; end if;
  begin
    select * into t from public.message_threads where id = new.thread_id;
    select a.name into v_assoc from public.associations a where a.id = t.association_id;
    select p.company_name, p.support_email into v_company, v_support from public.portfolios p where p.id = t.portfolio_id;
    if new.author_role = 'resident' then
      v_text := coalesce(new.author_name, 'A resident') || ' (' || coalesce(v_assoc, 'association') || ') wrote:' || chr(10) || chr(10)
             || new.body || chr(10) || chr(10) || 'Reply from the Inbox in Portier369.';
      v_html := '<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;white-space:pre-wrap;line-height:1.6;color:#111827">'
             || replace(replace(replace(v_text, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</div>';
      for r in
        select distinct lower(btrim(e)) as email from (
          select p.email as e from public.profiles p where p.id = t.assigned_to and p.disabled_at is null
          union all
          select pr.email from public.association_managers am join public.profiles pr on pr.id = am.user_id
           where t.assigned_to is null and am.association_id = t.association_id and am.ended_at is null and pr.disabled_at is null
          union all
          select pr.email from public.profiles pr
           where t.assigned_to is null and pr.portfolio_id = t.portfolio_id and pr.hoa_role = 'manager' and pr.disabled_at is null
             and not exists (select 1 from public.association_managers am where am.association_id = t.association_id and am.ended_at is null)
          union all select v_support where t.assigned_to is null
        ) x where e is not null and btrim(e) like '%@%'
      loop
        insert into public.email_queue (to_email, subject, body, association_id, portfolio_id, from_address, from_name, idempotency_key)
        values (r.email, 'New message: ' || t.subject, v_html, t.association_id, t.portfolio_id, 'hello@portier369.com',
                coalesce(v_company, 'Portier369'), 'msg:' || new.id || ':' || r.email)
        on conflict do nothing;
      end loop;
    else
      if t.owner_id is not null then select email, full_name into v_to, v_to_name from public.owners where id = t.owner_id;
      else select email, btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) into v_to, v_to_name from public.tenants where id = t.tenant_id; end if;
      if v_to is not null and btrim(v_to) like '%@%' then
        v_text := 'Hi ' || coalesce(nullif(v_to_name, ''), 'there') || ',' || chr(10) || chr(10)
               || coalesce(v_company, 'Your management team') || ' replied about "' || t.subject || '":' || chr(10) || chr(10)
               || new.body || chr(10) || chr(10) || 'Sign in to your portal to read the full conversation or reply.';
        v_html := '<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;white-space:pre-wrap;line-height:1.6;color:#111827">'
               || replace(replace(replace(v_text, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</div>';
        insert into public.email_queue (to_email, to_name, subject, body, association_id, portfolio_id, from_address, from_name, reply_to, owner_id, idempotency_key)
        values (lower(btrim(v_to)), nullif(v_to_name, ''), 'Re: ' || t.subject, v_html, t.association_id, t.portfolio_id, 'hello@portier369.com',
                coalesce(v_company, 'Portier369'), v_support, t.owner_id, 'msg:' || new.id)
        on conflict do nothing;
      end if;
    end if;
  exception when others then
    raise warning 'message_notify failed for %: %', new.id, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists trg_message_notify on public.message_thread_messages;
create trigger trg_message_notify after insert on public.message_thread_messages
  for each row execute function public.message_notify();
