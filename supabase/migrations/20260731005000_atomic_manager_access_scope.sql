-- Company administrators must be able to change a manager's association
-- scope without leaving a partially deleted/inserted assignment set.

create or replace function public.set_manager_association_scope(
  p_manager_id uuid,
  p_association_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_portfolio_id uuid;
  v_actor_email text;
  v_association_ids uuid[] := coalesce(p_association_ids, array[]::uuid[]);
  v_association_count integer;
begin
  select p.portfolio_id, p.email
    into v_portfolio_id, v_actor_email
  from public.profiles p
  where p.id = v_actor_id
    and p.hoa_role = 'company_admin'
    and p.disabled_at is null;

  if v_portfolio_id is null then
    raise exception 'Active company administrator access is required';
  end if;

  if not exists (
    select 1
    from public.profiles manager
    where manager.id = p_manager_id
      and manager.portfolio_id = v_portfolio_id
      and manager.hoa_role = 'manager'
  ) then
    raise exception 'Manager not found in your portfolio';
  end if;

  if exists (
    select 1
    from unnest(v_association_ids) requested(association_id)
    left join public.associations association
      on association.id = requested.association_id
     and association.portfolio_id = v_portfolio_id
     and association.archived_at is null
    where association.id is null
  ) then
    raise exception 'One or more associations are outside your portfolio';
  end if;

  delete from public.association_managers
  where user_id = p_manager_id;

  insert into public.association_managers (
    user_id,
    association_id,
    portfolio_id,
    assigned_by
  )
  select
    p_manager_id,
    requested.association_id,
    v_portfolio_id,
    v_actor_id
  from (
    select distinct association_id
    from unnest(v_association_ids) item(association_id)
  ) requested;

  get diagnostics v_association_count = row_count;

  insert into public.audit_logs (
    portfolio_id,
    entity_type,
    entity_id,
    action,
    actor_id,
    actor_email,
    changes
  ) values (
    v_portfolio_id,
    'user',
    p_manager_id,
    'manager_association_scope_updated',
    v_actor_id,
    v_actor_email,
    jsonb_build_object(
      'association_ids', to_jsonb(v_association_ids),
      'full_portfolio_access', v_association_count = 0
    )
  );

  return jsonb_build_object(
    'manager_id', p_manager_id,
    'association_count', v_association_count,
    'full_portfolio_access', v_association_count = 0
  );
end;
$function$;

revoke all on function public.set_manager_association_scope(uuid, uuid[])
  from public, anon;
grant execute on function public.set_manager_association_scope(uuid, uuid[])
  to authenticated;
