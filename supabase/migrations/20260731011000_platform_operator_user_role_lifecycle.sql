-- Platform profile role changes must be administrator-only, enum-safe, and
-- atomic across the profile, detailed staff role, manager scope, and audit log.

create or replace function public.platform_set_profile_role(
  p_profile_id uuid,
  p_hoa_role public.hoa_role
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_actor_email text;
  v_target public.profiles;
  v_manager_role_id uuid;
begin
  select operator.email
  into v_actor_email
  from public.platform_operators operator
  where operator.auth_user_id = v_actor_id
    and operator.active
    and operator.role = 'admin';

  if v_actor_email is null then
    raise exception 'Active platform administrator access is required';
  end if;

  if p_profile_id = v_actor_id then
    raise exception 'You cannot change your own platform profile role here';
  end if;

  if exists (
    select 1
    from public.platform_operators operator
    where operator.auth_user_id = p_profile_id
  ) then
    raise exception 'Platform operator accounts must be managed separately';
  end if;

  select profile.*
  into v_target
  from public.profiles profile
  where profile.id = p_profile_id
  for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  if p_hoa_role in ('company_admin', 'manager') and v_target.portfolio_id is null then
    raise exception 'Company staff must belong to a portfolio';
  end if;

  if p_hoa_role = 'manager' then
    select role.id
    into v_manager_role_id
    from public.user_roles role
    where role.name = 'Property Manager'
      and (
        role.portfolio_id = v_target.portfolio_id
        or (role.is_system and role.portfolio_id is null)
      )
    order by (role.portfolio_id = v_target.portfolio_id) desc nulls last
    limit 1;

    if v_manager_role_id is null then
      raise exception 'The Property Manager role is not configured';
    end if;
  end if;

  update public.profiles
  set hoa_role = p_hoa_role,
      role_id = case when p_hoa_role = 'manager' then v_manager_role_id else null end,
      updated_at = now()
  where id = p_profile_id;

  if v_target.hoa_role = 'manager' and p_hoa_role <> 'manager' then
    delete from public.association_managers
    where user_id = p_profile_id;
  end if;

  insert into public.audit_logs (
    portfolio_id,
    entity_type,
    entity_id,
    action,
    actor_id,
    actor_email,
    changes
  ) values (
    v_target.portfolio_id,
    'user',
    p_profile_id,
    'user_role_changed',
    v_actor_id,
    v_actor_email,
    jsonb_build_object(
      'previous_hoa_role', v_target.hoa_role,
      'hoa_role', p_hoa_role,
      'previous_role_id', v_target.role_id,
      'role_id', v_manager_role_id
    )
  );

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'previous_hoa_role', v_target.hoa_role,
    'hoa_role', p_hoa_role,
    'role_id', v_manager_role_id
  );
end;
$function$;

revoke all on function public.platform_set_profile_role(uuid, public.hoa_role)
  from public, anon;
grant execute on function public.platform_set_profile_role(uuid, public.hoa_role)
  to authenticated;
