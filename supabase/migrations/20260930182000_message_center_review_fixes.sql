-- Review fixes for the message center:
-- 1. Staff-to-owner conversations resolved the owner's unit only from the
--    legacy unit_owners table; owners linked the current way (occupancies)
--    got "Recipient not found". Resolve from current owner occupancies first,
--    then fall back to unit_owners.
-- 2. New threads now record the opening message as the last message
--    (preview + role). Without it a resident's first reply to a
--    staff-started thread never restarted the reply clock, and lists showed
--    a blank preview.
create or replace function public.start_staff_message_thread(p_owner uuid, p_tenant uuid, p_subject text, p_body text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_assoc uuid; v_portfolio uuid; v_unit uuid; v_id uuid;
begin
  if auth.uid() is null or not public.is_messaging_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if (p_owner is null) = (p_tenant is null) then raise exception 'Pick one recipient' using errcode = '22023'; end if;
  if p_owner is not null then
    select b.association_id, a.portfolio_id, o.unit_id into v_assoc, v_portfolio, v_unit
      from public.occupancies o join public.units u on u.id = o.unit_id join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id
     where o.owner_id = p_owner and o.status = 'current' and o.occupancy_type = 'owner'
       and public.can_access_portfolio(a.portfolio_id) and public.can_manage_association(b.association_id)
     order by o.is_primary desc nulls last, o.created_at
     limit 1;
    if v_assoc is null then
      select b.association_id, a.portfolio_id, uo.unit_id into v_assoc, v_portfolio, v_unit
        from public.unit_owners uo join public.units u on u.id = uo.unit_id join public.buildings b on b.id = u.building_id
        join public.associations a on a.id = b.association_id
       where uo.owner_id = p_owner and uo.end_date is null
         and public.can_access_portfolio(a.portfolio_id) and public.can_manage_association(b.association_id)
       order by uo.is_primary desc nulls last
       limit 1;
    end if;
  else
    select t.association_id, t.portfolio_id, t.unit_id into v_assoc, v_portfolio, v_unit
      from public.tenants t where t.id = p_tenant and t.archived_at is null;
  end if;
  if v_assoc is null or not public.can_access_portfolio(v_portfolio) or not public.can_manage_association(v_assoc) then
    raise exception 'Recipient not found' using errcode = 'P0002';
  end if;
  insert into public.message_threads (portfolio_id, association_id, unit_id, owner_id, tenant_id, subject, started_by_role,
                                      created_by, resident_unread, assigned_to, acknowledged_at,
                                      last_message_preview, last_message_role)
  values (v_portfolio, v_assoc, v_unit, p_owner, p_tenant, btrim(p_subject), 'staff', auth.uid(), true, auth.uid(), now(),
          left(btrim(p_body), 140), 'staff')
  returning id into v_id;
  insert into public.message_thread_messages (thread_id, author_id, author_role, author_name, body)
  values (v_id, auth.uid(), 'staff', public.message_author_name(), btrim(p_body));
  return v_id;
end $$;

do $$
declare v_def text; v_old text;
begin
  select pg_get_functiondef('public.start_resident_message_thread(uuid, text, text)'::regprocedure) into v_def;
  v_old := E'                                      created_by, staff_unread, first_response_due_at)\n'
        || E'  values (v_portfolio, v_assoc, p_unit, v_owner, v_tenant, btrim(p_subject), ''resident'', auth.uid(), true, now() + interval ''48 hours'')';
  if position(v_old in v_def) = 0 then raise exception 'resident start anchor not found'; end if;
  execute replace(v_def, v_old,
    E'                                      created_by, staff_unread, first_response_due_at, last_message_preview, last_message_role)\n'
    || E'  values (v_portfolio, v_assoc, p_unit, v_owner, v_tenant, btrim(p_subject), ''resident'', auth.uid(), true, now() + interval ''48 hours'',\n'
    || E'          left(btrim(p_body), 140), ''resident'')');
end $$;

-- Existing threads: fill the last-message fields from their newest visible message.
update public.message_threads t
   set last_message_preview = (select left(m.body, 140) from public.message_thread_messages m
                                where m.thread_id = t.id and not m.internal order by m.created_at desc limit 1),
       last_message_role = (select m.author_role from public.message_thread_messages m
                             where m.thread_id = t.id and not m.internal order by m.created_at desc limit 1)
 where t.last_message_role is null;
