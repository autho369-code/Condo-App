-- Settings -> Team: remove_staff_member / assign_role must only act on staff
-- profiles. Previously an admin could "remove" a vendor/board/owner profile
-- (breaking their portal: portfolio_id null, hoa_role 'owner') or give a
-- homeowner a staff role via assign_role. Both RPCs now refuse targets whose
-- current hoa_role is not a staff role (manager, company_admin).

create or replace function public.assign_role(p_profile_id uuid, p_role_id uuid)
 returns profiles
 language plpgsql
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  target public.profiles;
  target_role public.user_roles;
begin
  select * into target from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'assign_role: profile % not found', p_profile_id;
  end if;

  if not public.can_admin_portfolio(target.portfolio_id) then
    raise exception 'assign_role: must be admin of profile''s portfolio';
  end if;

  if target.hoa_role is null or target.hoa_role::text not in ('manager', 'company_admin') then
    raise exception 'assign_role: staff roles can only be assigned to staff members (target is %)', coalesce(target.hoa_role::text, 'unknown');
  end if;

  select * into target_role from public.user_roles where id = p_role_id;
  if not found then
    raise exception 'assign_role: role % not found', p_role_id;
  end if;
  if target_role.portfolio_id is not null and target_role.portfolio_id <> target.portfolio_id then
    raise exception 'assign_role: role belongs to a different portfolio';
  end if;

  update public.profiles
     set role_id = p_role_id, updated_at = now()
   where id = p_profile_id
   returning * into target;
  return target;
end;
$function$;

create or replace function public.remove_staff_member(p_profile_id uuid, p_reason text default null::text)
 returns profiles
 language plpgsql
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  target public.profiles;
  updated public.profiles;
begin
  select * into target from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'remove_staff_member: profile not found';
  end if;

  if not public.can_admin_portfolio(target.portfolio_id) then
    raise exception 'remove_staff_member: must be admin of profile''s portfolio';
  end if;

  if target.hoa_role is null or target.hoa_role::text not in ('manager', 'company_admin') then
    raise exception 'remove_staff_member: only staff members can be removed from the team (target is %)', coalesce(target.hoa_role::text, 'unknown');
  end if;

  if p_profile_id = auth.uid() then
    raise exception 'remove_staff_member: cannot remove yourself';
  end if;

  update public.profiles
     set portfolio_id = null,
         role_id = null,
         hoa_role = 'owner',
         updated_at = now()
   where id = p_profile_id
   returning * into updated;

  -- Log reason separately into audit log details
  insert into public.permission_audit_log (
    actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
    action, details
  ) values (
    auth.uid(), target.portfolio_id, 'profile', p_profile_id,
    'staff_removed',
    jsonb_build_object('reason', p_reason)
  );

  return updated;
end;
$function$;
