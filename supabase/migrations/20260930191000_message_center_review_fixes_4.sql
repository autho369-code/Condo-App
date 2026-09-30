-- Review fixes for the message center (round 4):
-- 1. Someone who is BOTH staff and a resident was always treated as staff, so
--    a reply from their resident portal was recorded as a management answer.
--    The caller now says which side it is acting on (p_as = 'resident' from
--    the portals, 'staff' from the inbox); access is checked for that side.
-- 2. If the assignee is disabled or has no email, resident messages now fall
--    back to the association's managers / company managers / support inbox
--    instead of notifying nobody.
-- 3. The restrictive association scope (for association-scoped managers) no
--    longer hides a thread from its own resident party.

drop function if exists public.post_message(uuid, text, boolean);
drop function if exists public.mark_message_thread_read(uuid);
drop function if exists public.set_message_thread_status(uuid, text);
drop function if exists public.assign_message_thread(uuid, uuid);
drop function if exists public.message_thread_access(uuid);

create or replace function public.message_thread_access(p_thread uuid, p_as text, out role text, out thread public.message_threads)
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_staff boolean; v_resident boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into thread from public.message_threads where id = p_thread for update;
  if not found then raise exception 'Conversation not found' using errcode = 'P0002'; end if;
  v_staff := public.is_messaging_staff() and public.can_access_portfolio(thread.portfolio_id)
             and public.can_manage_association(thread.association_id);
  v_resident := (thread.owner_id is not null and thread.owner_id = public.current_owner_id())
             or (thread.tenant_id is not null and thread.tenant_id in (select public.current_tenant_ids()));
  if p_as = 'resident' and v_resident then role := 'resident';
  elsif p_as = 'staff' and v_staff then role := 'staff';
  else raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
end $$;
revoke all on function public.message_thread_access(uuid, text) from public, anon, authenticated;

create or replace function public.post_message(p_thread uuid, p_body text, p_internal boolean, p_as text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare a record; v_id uuid; v_name text;
begin
  select * into a from public.message_thread_access(p_thread, p_as);
  if a.role = 'resident' then
    if coalesce(p_internal, false) then raise exception 'Not allowed' using errcode = '42501'; end if;
    if (a.thread).owner_id is not null then select full_name into v_name from public.owners where id = (a.thread).owner_id;
    else select btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) into v_name from public.tenants where id = (a.thread).tenant_id; end if;
    insert into public.message_thread_messages (thread_id, author_id, author_role, author_name, body)
    values (p_thread, auth.uid(), 'resident', nullif(v_name, ''), btrim(p_body)) returning id into v_id;
    update public.message_threads
       set staff_unread = true, status = 'open', closed_at = null,
           last_message_at = now(), last_message_preview = left(btrim(p_body), 140), last_message_role = 'resident',
           -- The clock only restarts when the resident writes after a staff reply.
           first_response_due_at = case when last_message_role is distinct from 'resident' or first_response_due_at is null
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
  select * into a from public.message_thread_access(p_thread, 'staff');
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
  select * into a from public.message_thread_access(p_thread, 'staff');
  if p_user is not null and not public.can_be_assigned_message_thread(p_user, (a.thread).portfolio_id, (a.thread).association_id) then
    raise exception 'That person can''t see this association''s conversations' using errcode = '22023';
  end if;
  update public.message_threads set assigned_to = p_user where id = p_thread;
end $$;

create or replace function public.mark_message_thread_read(p_thread uuid, p_as text)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare a record;
begin
  select * into a from public.message_thread_access(p_thread, p_as);
  if a.role = 'staff' then update public.message_threads set staff_unread = false where id = p_thread;
  else update public.message_threads set resident_unread = false where id = p_thread; end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array['post_message(uuid, text, boolean, text)', 'set_message_thread_status(uuid, text)',
                           'assign_message_thread(uuid, uuid)', 'mark_message_thread_read(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 3. Association scoping applies to staff access only.
drop policy if exists mgr_assoc_scope on public.message_threads;
create policy mgr_assoc_scope on public.message_threads as restrictive for all to authenticated
  using (public.can_view_association_row(association_id)
         or (message_threads.owner_id is not null and message_threads.owner_id = public.current_owner_id())
         or (message_threads.tenant_id is not null and message_threads.tenant_id in (select public.current_tenant_ids())));

-- 2. Notify fallbacks when the assignee can't receive email.
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.message_notify()'::regprocedure) into v_def;
  if position('t.assigned_to is null' in v_def) = 0 then raise exception 'message_notify anchor not found'; end if;
  v_def := replace(v_def, 't.assigned_to is null', 'not v_assignee_ok');
  v_def := replace(v_def, E'  v_text text; v_html text; r record;\n', E'  v_text text; v_html text; r record; v_assignee_ok boolean;\n');
  v_def := replace(v_def, E'    if new.author_role = ''resident'' then\n',
    E'    if new.author_role = ''resident'' then\n'
    || E'      select exists (select 1 from public.profiles p where p.id = t.assigned_to and p.disabled_at is null and btrim(coalesce(p.email, '''')) like ''%@%'') into v_assignee_ok;\n');
  if position('v_assignee_ok boolean' in v_def) = 0 or position('into v_assignee_ok' in v_def) = 0 then
    raise exception 'message_notify rewrite failed';
  end if;
  execute v_def;
end $$;
