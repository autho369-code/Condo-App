-- Communications follow-ups (deep check 2026-10-13).
--
-- 1. Inbound texts: one row per Twilio message id (a webhook Twilio retries
--    must not record a reply twice).
-- 2. post_message: an owner who no longer owns a unit in the association
--    (sold, by the association's own date) can still read their old
--    conversations but can't reply (starting one already required a current
--    ownership).
-- 3. message_notify: the email to staff links to the conversation in the
--    Inbox, and the email to the owner or tenant links to it in their portal
--    (it said "sign in" with no link). Links use the company's verified
--    custom domain, else its <slug>.portier369.com address. An email that
--    can't be queued is recorded in the communications log as failed, where
--    staff see it (it was only a server warning).
-- 4. Fix for a regression from 20261014220000 (applied live first as a
--    hotfix): the worker-columns guard checked auth.role(), which is still
--    'authenticated' inside SECURITY DEFINER functions an owner's or tenant's
--    action runs. Since 20261014220000 its company lookup answers only for
--    company staff, so those trusted emails were refused (staff weren't
--    emailed about owner messages). It checks current_user now, like the
--    other queue guards (this guard is not SECURITY DEFINER, so current_user
--    is the signed-in role on direct writes and the function owner inside
--    definer functions).
-- 5. add_record_note: the mention email links to the company's own address,
--    not a host the caller passes (security review).

-- 1. ---------------------------------------------------------------------------
create unique index if not exists sms_messages_provider_message_id_key
  on public.sms_messages(provider_message_id)
  where provider_message_id is not null;

-- 2. ---------------------------------------------------------------------------
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.post_message(uuid,text,boolean,text)'::regprocedure), E'\r\n', E'\n');
  v_anchor text := E'    if coalesce(p_internal, false) then raise exception ''Not allowed'' using errcode = ''42501''; end if;\n';
  -- An earlier version of this patch (live before review) used UTC's date
  -- and other wording; it is replaced by the final block.
  v_old_block text := E'    -- A former owner (sold) reads their old conversations but doesn''t post.\n'
             || E'    if (a.thread).owner_id is not null and not exists (\n'
             || E'         select 1 from public.occupancies o\n'
             || E'          where o.owner_id = (a.thread).owner_id and o.status = ''current''\n'
             || E'            and (o.move_out_date is null or o.move_out_date > current_date)\n'
             || E'            and ((a.thread).association_id is null or o.association_id = (a.thread).association_id)) then\n'
             || E'      raise exception ''This conversation is closed because you no longer own a unit in this association'' using errcode = ''42501'';\n'
             || E'    end if;\n';
  v_new_block text := E'    -- A former owner (sold, by the association''s own date) reads their old\n'
             || E'    -- conversations but doesn''t reply.\n'
             || E'    if (a.thread).owner_id is not null and not exists (\n'
             || E'         select 1 from public.occupancies o\n'
             || E'          where o.owner_id = (a.thread).owner_id and o.status = ''current''\n'
             || E'            and (o.move_out_date is null or o.move_out_date > public.association_local_date(o.association_id))\n'
             || E'            and ((a.thread).association_id is null or o.association_id = (a.thread).association_id)) then\n'
             || E'      raise exception ''You can read this conversation but can''''t reply, because you no longer own a unit in this association. Contact your management company if you need help'' using errcode = ''42501'';\n'
             || E'    end if;\n';
begin
  if position('by the association''s own date) reads their old' in v_def) > 0 then
    raise notice 'post_message already patched';
    return;
  end if;
  if position(v_old_block in v_def) > 0 then
    v_def := replace(v_def, v_old_block, v_new_block);
  else
    if array_length(string_to_array(v_def, v_anchor), 1) <> 2 then
      raise exception 'post_message: expected text not found exactly once';
    end if;
    v_def := replace(v_def, v_anchor, v_anchor || v_new_block);
  end if;
  execute v_def;
end
$do$;

-- 3. ---------------------------------------------------------------------------
create or replace function public.message_notify()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  t public.message_threads; v_assoc text; v_company text; v_support text; v_slug text; v_base text;
  v_custom text; v_custom_verified timestamptz; v_link text;
  v_to text; v_to_name text; v_text text; v_html text; r record; v_assignee_ok boolean;
begin
  if new.internal then return new; end if;
  begin
    select * into t from public.message_threads where id = new.thread_id;
    select a.name into v_assoc from public.associations a where a.id = t.association_id;
    select p.company_name, p.support_email, p.slug, p.custom_domain, p.custom_domain_verified_at
      into v_company, v_support, v_slug, v_custom, v_custom_verified
      from public.portfolios p where p.id = t.portfolio_id;
    -- The company's own address: its verified custom domain, else its
    -- <slug>.portier369.com address.
    v_base := case
      when v_custom is not null and v_custom_verified > now() - interval '3 hours' then 'https://' || v_custom
      when v_slug ~ '^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])$' then 'https://' || v_slug || '.portier369.com'
      else rtrim(public.app_portal_url(), '/')
    end;
    if new.author_role = 'resident' then
      v_link := v_base || '/inbox/' || t.id;
      select exists (select 1 from public.profiles p where p.id = t.assigned_to and p.disabled_at is null and btrim(coalesce(p.email, '')) like '%@%') into v_assignee_ok;
      v_text := coalesce(new.author_name, 'A resident') || coalesce(' (' || v_assoc || ')', '') || ' wrote:' || chr(10) || chr(10)
             || new.body || chr(10) || chr(10) || 'Reply from the Inbox: ' || v_link;
      v_html := '<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;white-space:pre-wrap;line-height:1.6;color:#111827">'
             || replace(replace(replace(v_text, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</div>';
      for r in
        select distinct lower(btrim(e)) as email from (
          select p.email as e from public.profiles p where p.id = t.assigned_to and p.disabled_at is null
          union all
          select pr.email from public.association_managers am join public.profiles pr on pr.id = am.user_id
           where not v_assignee_ok and am.association_id = t.association_id and am.ended_at is null and pr.disabled_at is null
          union all
          select pr.email from public.profiles pr
           where not v_assignee_ok and pr.portfolio_id = t.portfolio_id and pr.hoa_role = 'manager' and pr.disabled_at is null
             and not exists (select 1 from public.association_managers own where own.user_id = pr.id)
             and not exists (select 1 from public.association_managers am where am.association_id = t.association_id and am.ended_at is null)
          union all select v_support where not v_assignee_ok
        ) x where e is not null and btrim(e) like '%@%'
      loop
        insert into public.email_queue (to_email, subject, body, association_id, portfolio_id, from_address, from_name, idempotency_key)
        values (r.email, 'New message: ' || t.subject, v_html, t.association_id, t.portfolio_id, 'hello@portier369.com',
                v_company, 'msg:' || new.id || ':' || r.email)
        on conflict do nothing;
      end loop;
    else
      v_link := v_base || case when t.owner_id is not null then '/portal/messages/' else '/resident/messages/' end || t.id;
      if t.owner_id is not null then select email, full_name into v_to, v_to_name from public.owners where id = t.owner_id;
      else select email, btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) into v_to, v_to_name from public.tenants where id = t.tenant_id; end if;
      if v_to is not null and btrim(v_to) like '%@%' then
        v_text := 'Hi ' || coalesce(nullif(v_to_name, ''), 'there') || ',' || chr(10) || chr(10)
               || coalesce(v_company, 'Your management company') || ' replied about "' || t.subject || '":' || chr(10) || chr(10)
               || new.body || chr(10) || chr(10) || 'Read the conversation and reply: ' || v_link;
        v_html := '<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;white-space:pre-wrap;line-height:1.6;color:#111827">'
               || replace(replace(replace(v_text, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</div>';
        insert into public.email_queue (to_email, to_name, subject, body, association_id, portfolio_id, from_address, from_name, reply_to, owner_id, idempotency_key)
        values (lower(btrim(v_to)), nullif(v_to_name, ''), 'Re: ' || t.subject, v_html, t.association_id, t.portfolio_id, 'hello@portier369.com',
                v_company, v_support, t.owner_id, 'msg:' || new.id)
        on conflict do nothing;
      end if;
    end if;
  exception when others then
    -- The message itself is kept; staff see the email that wasn't sent.
    begin
      insert into public.communications_log (portfolio_id, association_id, channel, direction, status, subject, body, error_message)
      values (t.portfolio_id, t.association_id, 'email', 'outbound', 'failed',
              'Email not sent for message: ' || coalesce(t.subject, 'conversation'),
              'The email about a new message in "' || coalesce(t.subject, 'a conversation') || '" was not sent. '
                || 'Open the conversation in the Inbox to follow up: ' || coalesce(v_base, '') || '/inbox/' || t.id,
              left(sqlerrm, 500));
    exception when others then
      raise warning 'message_notify failed for % and could not be logged: %', new.id, sqlerrm;
    end;
  end;
  return new;
end $function$;

-- 4. ---------------------------------------------------------------------------
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.email_queue_guard_worker_columns()'::regprocedure), E'\r\n', E'\n');
  v_old text := E'  if coalesce(auth.role(), '''') in (''authenticated'', ''anon'') then\n';
  v_new text := E'  -- Direct writes by signed-in users (current_user), not trusted functions.\n'
             || E'  if current_user in (''authenticated'', ''anon'') then\n';
begin
  if position('if current_user in (''authenticated'', ''anon'') then' in v_def) > 0 then
    raise notice 'email_queue_guard_worker_columns already patched';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'email_queue_guard_worker_columns: expected text not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

-- 5. ---------------------------------------------------------------------------
-- add_record_note (security review): the "Open the record" link in the mention
-- email used any https host the caller passed (p_app_url), so a staff login
-- calling the RPC directly could send colleagues a link to their own site
-- from the platform's address. The link now uses the company's own address;
-- p_app_url is ignored (kept in the signature for callers).
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.add_record_note(text,uuid,text,uuid[],text)'::regprocedure), E'\r\n', E'\n');
  v_old text := E'  if v_base !~ ''^https://[a-z0-9.-]+(:[0-9]+)?$'' then v_base := ''https://portier369.com''; end if;\n';
  v_new text := E'  -- The link goes to the company''s own address, never one the caller passes.\n'
             || E'  select case\n'
             || E'           when p.custom_domain is not null and p.custom_domain_verified_at > now() - interval ''3 hours'' then ''https://'' || p.custom_domain\n'
             || E'           when p.slug ~ ''^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])$'' then ''https://'' || p.slug || ''.portier369.com''\n'
             || E'           else rtrim(public.app_portal_url(), ''/'')\n'
             || E'         end into v_base\n'
             || E'    from public.portfolios p where p.id = v_pid;\n';
begin
  if position('never one the caller passes' in v_def) > 0 then
    raise notice 'add_record_note already patched';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'add_record_note: expected text not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;
