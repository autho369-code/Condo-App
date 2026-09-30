-- Review fix: staff messaging an owner who owns several units had the unit
-- chosen arbitrarily (is_primary is per occupancy, not per owner), so the
-- conversation could land in the wrong association. start_staff_message_thread
-- now takes the unit: it must be one of the owner's current units in an
-- association the caller manages. Without a unit, an owner with exactly one
-- such unit still works; more than one is refused ("Pick the unit").
drop function if exists public.start_staff_message_thread(uuid, uuid, text, text);

create or replace function public.start_staff_message_thread(
  p_owner uuid, p_tenant uuid, p_subject text, p_body text, p_unit uuid default null)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_assoc uuid; v_portfolio uuid; v_unit uuid; v_id uuid; v_count int;
begin
  if auth.uid() is null or not public.is_messaging_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if (p_owner is null) = (p_tenant is null) then raise exception 'Pick one recipient' using errcode = '22023'; end if;
  if p_owner is not null then
    with owned as (
      select o.unit_id from public.occupancies o
       where o.owner_id = p_owner and o.status = 'current' and o.occupancy_type = 'owner'
      union
      select uo.unit_id from public.unit_owners uo where uo.owner_id = p_owner and uo.end_date is null
    ), scoped as (
      select u.id as unit_id, b.association_id, a.portfolio_id
        from owned join public.units u on u.id = owned.unit_id
        join public.buildings b on b.id = u.building_id join public.associations a on a.id = b.association_id
       where public.can_access_portfolio(a.portfolio_id) and public.can_manage_association(b.association_id)
    )
    select count(*) into v_count from scoped;
    if p_unit is not null then
      select s.association_id, s.portfolio_id, s.unit_id into v_assoc, v_portfolio, v_unit
        from (
          select u.id as unit_id, b.association_id, a.portfolio_id
            from public.units u join public.buildings b on b.id = u.building_id join public.associations a on a.id = b.association_id
           where u.id = p_unit
             and (exists (select 1 from public.occupancies o where o.unit_id = u.id and o.owner_id = p_owner and o.status = 'current' and o.occupancy_type = 'owner')
                  or exists (select 1 from public.unit_owners uo where uo.unit_id = u.id and uo.owner_id = p_owner and uo.end_date is null))
        ) s;
    elsif v_count = 1 then
      select s.association_id, s.portfolio_id, s.unit_id into v_assoc, v_portfolio, v_unit
        from (
          select u.id as unit_id, b.association_id, a.portfolio_id
            from public.units u join public.buildings b on b.id = u.building_id join public.associations a on a.id = b.association_id
           where u.id in (select o.unit_id from public.occupancies o where o.owner_id = p_owner and o.status = 'current' and o.occupancy_type = 'owner'
                          union select uo.unit_id from public.unit_owners uo where uo.owner_id = p_owner and uo.end_date is null)
             and public.can_access_portfolio(a.portfolio_id) and public.can_manage_association(b.association_id)
        ) s;
    elsif v_count > 1 then
      raise exception 'This owner has more than one unit — pick the unit the message is about' using errcode = '22023';
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
revoke all on function public.start_staff_message_thread(uuid, uuid, text, text, uuid) from public, anon;
grant execute on function public.start_staff_message_thread(uuid, uuid, text, text, uuid) to authenticated;
