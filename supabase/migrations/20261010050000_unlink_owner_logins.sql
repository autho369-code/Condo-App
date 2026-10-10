-- "Unlink login" on an owner record (Mirsad, 2026-10-10): staff cut off every
-- login of one owner record in one step: the record's original login
-- (owners.auth_user_id, portal turned off) and every login added to it
-- (owner_portal_logins, revoked). Changing the record's email is not the way
-- to do this (it only revokes added logins whose own email no longer
-- matches, so a typo fix stays harmless). The person's access ends on their
-- next request (current_owner_ids reads these rows every time); their other
-- records and roles are untouched. Logged to audit_logs.

create or replace function public.unlink_owner_logins(p_owner_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_owner public.owners;
  v_added integer := 0;
begin
  select * into v_owner from public.owners where id = p_owner_id for update;
  if not found then
    raise exception 'Owner not found.' using errcode = 'P0002';
  end if;
  -- Staff of the owner's association (scoped managers: their associations
  -- only); platform operators only when they may change company data.
  if not (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())
     or not public.can_manage_association(v_owner.association_id)
     or not public.operator_may_write(false) then
    raise exception 'You cannot change this owner''s logins.' using errcode = '42501';
  end if;

  update public.owner_portal_logins
     set revoked_at = now()
   where owner_id = p_owner_id
     and revoked_at is null;
  get diagnostics v_added = row_count;

  if v_owner.auth_user_id is not null or v_owner.portal_activated then
    update public.owners
       set auth_user_id = null, portal_activated = false
     where id = p_owner_id;
  end if;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (v_owner.portfolio_id, 'owner', p_owner_id, 'owner_logins_unlinked', auth.uid(),
          jsonb_build_object('original_login', v_owner.auth_user_id, 'added_logins_revoked', v_added));

  return v_added + case when v_owner.auth_user_id is not null then 1 else 0 end;
end;
$function$;

revoke all on function public.unlink_owner_logins(uuid) from public, anon;
grant execute on function public.unlink_owner_logins(uuid) to authenticated, service_role;
