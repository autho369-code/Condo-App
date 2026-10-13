-- Follow-ups to 20261013120000 (migration-reviewer on #340).
--
-- The whole-company branch for unscoped managers now requires
--   * hoa_role = 'manager': manager_is_scoped() decides "unscoped" from
--     hoa_role, so a profile marked manager only through mvp_role must not
--     count as unscoped (none exist on production; nothing enforced it);
--   * an enabled account (is_current_identity_enabled), so a disabled
--     manager with a live session gains nothing company-wide.
-- The set copy of can_access_confidential_meeting_mvp gets the same branch
-- (its identity check is already at the top), and the function now names
-- its copy so both change together.

create or replace function public.can_edit_association_mvp(a_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$#variable_conflict use_column
begin
  return (select s.x from (
  select a_id is not null
    and (
      public.is_platform_operator()
      or exists (
        select 1
        from public.profiles p
        join public.associations a on a.portfolio_id = p.portfolio_id
        where p.id = auth.uid()
          and (p.mvp_role in ('company_admin', 'accountant') or p.hoa_role = 'company_admin')
          and a.id = a_id
      )
      or exists (
        select 1
        from public.profiles p
        join public.association_managers am
          on am.user_id = p.id
         and am.ended_at is null
        join public.associations a
          on a.id = am.association_id
         and a.portfolio_id = p.portfolio_id
        where p.id = auth.uid()
          and (
            p.mvp_role = 'manager'
            or (p.mvp_role is null and p.hoa_role = 'manager')
          )
          and a.id = a_id
      )
      -- an enabled manager not limited to some associations: the whole company
      or (public.manager_is_scoped() is not true
          and public.is_current_identity_enabled()
          and exists (
            select 1
            from public.profiles p
            join public.associations a on a.portfolio_id = p.portfolio_id
            where p.id = auth.uid()
              and p.hoa_role = 'manager'
              and (p.mvp_role is null or p.mvp_role = 'manager')
              and a.id = a_id
          ))
    )
  ) s(x) limit 1);
end$function$;

create or replace function rls_private.my_confidential_meeting_association_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  -- can_access_confidential_meeting_mvp, as a set. Change both together.
  if not coalesce(public.is_current_identity_enabled(), false) then
    return;
  end if;
  if coalesce(public.is_platform_operator(), false) then
    return query select a.id from public.associations a;
    return;
  end if;
  return query
  select a.id
    from public.profiles p
    join public.associations a on a.portfolio_id = p.portfolio_id
   where p.id = auth.uid()
     and (p.mvp_role in ('company_admin', 'accountant') or p.hoa_role = 'company_admin')
  union
  select a.id
    from public.profiles p
    join public.association_managers am on am.user_id = p.id and am.ended_at is null
    join public.associations a on a.id = am.association_id and a.portfolio_id = p.portfolio_id
   where p.id = auth.uid()
     and (p.mvp_role = 'manager' or (p.mvp_role is null and p.hoa_role = 'manager'))
  union
  select a.id
    from public.profiles p
    join public.associations a on a.portfolio_id = p.portfolio_id
   where p.id = auth.uid()
     and p.hoa_role = 'manager'
     and (p.mvp_role is null or p.mvp_role = 'manager')
     and public.manager_is_scoped() is not true
  union
  select a.id
    from public.profiles p
    join public.association_managers am on am.user_id = p.id and am.ended_at is null
    join public.associations a on a.id = am.association_id and a.portfolio_id = p.portfolio_id
   where p.id = auth.uid()
     and p.disabled_at is null
     and p.mvp_role = 'assistant_manager'
  union
  select bm.association_id
    from public.board_members bm
   where bm.auth_user_id = auth.uid()
     and bm.active = true
     and bm.association_id is not null;
end
$$;

comment on function public.can_access_confidential_meeting_mvp(uuid) is
  'Policies on agenda_items, meeting_documents and meeting_action_items use the set copy '
  'rls_private.my_confidential_meeting_association_ids(); change both together '
  '(20261013110000, 20261013120000, 20261013130000).';
