-- Communications privacy fixes.
--
-- 1. notices: mass email wrote one row per recipient (send_to = address) and
--    residents could read every 'sent' notice for their association, i.e.
--    neighbours' email addresses and board-only/tenant-only bodies. The app no
--    longer writes per-recipient rows; residents and board members now only
--    see association-wide notices (send_to is null) or ones addressed to them.
-- 2. communications_log: board members could read owners' private inbound
--    messages to management. Board read is limited to outbound rows.
-- 3. submit_owner_message / submit_tenant_message put the sender's profile
--    name/email (user-editable) and unit number into HTML email unescaped, and
--    still emailed disabled staff. Values are escaped with html_escape() and
--    disabled profiles are skipped.

drop policy if exists notices_resident_read on public.notices;
create policy notices_resident_read on public.notices
  for select to authenticated
  using (
    public.is_portal_resident()
    and status = 'sent'::public.notice_status
    and (
      (send_to is null and association_id in (select public.current_resident_association_ids()))
      or public.is_notice_recipient(id)
    )
  );

drop policy if exists notices_board_read on public.notices;
create policy notices_board_read on public.notices
  for select to authenticated
  using (
    public.is_board_user()
    and association_id in (select public.current_board_association_ids())
    and status <> 'draft'::public.notice_status
    and send_to is null
  );

drop policy if exists communications_board_read on public.communications_log;
create policy communications_board_read on public.communications_log
  for select to authenticated
  using (
    public.is_board_user()
    and association_id in (select public.current_board_association_ids())
    and direction = 'outbound'
  );

do $$
declare
  v_def text;
  v_new text;
  r record;
begin
  for r in
    select * from (values
      ('public.submit_owner_message(text,text,uuid)', 'sender_name', 'sender_email', 'occupancy_row.unit_number',
       'where a.id = occupancy_row.association_id and nullif(btrim(p.email), '''') is not null',
       'and p.hoa_role = ''company_admin''
         and nullif(btrim(p.email), '''') is not null'),
      ('public.submit_tenant_message(text,text,uuid)', 'v_sender_name', 'v_sender_email', 'v_unit_number',
       'where a.id = v_association_id and nullif(btrim(p.email), '''') is not null',
       null)
    ) as t(fn, name_var, email_var, unit_var, mgr_where, admin_where)
  loop
    select pg_get_functiondef(r.fn::regprocedure) into v_def;
    v_new := v_def;
    v_new := replace(v_new, '''New message from '' || ' || r.name_var, '''New message from '' || public.html_escape(' || r.name_var || ')');
    v_new := replace(v_new, '— Sent by '' || ' || r.name_var, '— Sent by '' || public.html_escape(' || r.name_var || ')');
    v_new := replace(v_new, ''' &lt;'' || ' || r.email_var || ' || ''&gt;''', ''' &lt;'' || public.html_escape(' || r.email_var || ') || ''&gt;''');
    v_new := replace(v_new, ''' (Unit '' || ' || r.unit_var || ' || '')''', ''' (Unit '' || public.html_escape(' || r.unit_var || ') || '')''');
    v_new := replace(v_new, r.mgr_where, r.mgr_where || ' and p.disabled_at is null');
    if r.admin_where is not null then
      v_new := replace(v_new, r.admin_where, r.admin_where || '
         and p.disabled_at is null');
    end if;
    if (length(v_new) - length(replace(v_new, 'public.html_escape(', ''))) / length('public.html_escape(') <> 4
       or (length(v_new) - length(replace(v_new, 'p.disabled_at is null', ''))) / length('p.disabled_at is null') <> 2 then
      raise exception '% did not match the expected definition', r.fn;
    end if;
    execute v_new;
  end loop;
end $$;
