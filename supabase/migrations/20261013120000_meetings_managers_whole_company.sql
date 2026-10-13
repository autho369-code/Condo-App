-- Meetings: a manager who is not limited to some associations can work on
-- every association of their company.
--
-- can_edit_association_mvp (meetings, agenda items, attendees, documents,
-- action items and meeting_private: insert/update/delete; reorder_agenda_items;
-- my_editable_association_ids) and the confidential-meeting read check let a
-- manager in only through an association_managers row. Everywhere else in the
-- product a manager with no such rows works on the whole company (that is
-- what manager_is_scoped() = false means), so on production a manager could
-- see a meeting but not its agenda, and could not create or edit meetings at
-- all; only company admins could. Found while speeding up the meeting
-- policies (2026-10-13); no meetings exist on production yet.
--
-- Now an unscoped manager (manager_is_scoped() is not true) also passes for
-- any association of their own company. Scoped managers keep their assigned
-- associations only; company admins, accountants, assistant managers, board
-- members and operators are unchanged.

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
      -- a manager not limited to some associations: the whole company
      or (public.manager_is_scoped() is not true and exists (
        select 1
        from public.profiles p
        join public.associations a on a.portfolio_id = p.portfolio_id
        where p.id = auth.uid()
          and (
            p.mvp_role = 'manager'
            or (p.mvp_role is null and p.hoa_role = 'manager')
          )
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
  -- can_access_confidential_meeting_mvp, as a set.
  if not coalesce(public.is_current_identity_enabled(), false) then
    return;
  end if;
  if coalesce(public.is_platform_operator(), false) then
    return query select a.id from public.associations a;
    return;
  end if;
  return query
  -- company admin / accountant: every association of their company
  select a.id
    from public.profiles p
    join public.associations a on a.portfolio_id = p.portfolio_id
   where p.id = auth.uid()
     and (p.mvp_role in ('company_admin', 'accountant') or p.hoa_role = 'company_admin')
  union
  -- manager: associations they are assigned to in their company
  select a.id
    from public.profiles p
    join public.association_managers am on am.user_id = p.id and am.ended_at is null
    join public.associations a on a.id = am.association_id and a.portfolio_id = p.portfolio_id
   where p.id = auth.uid()
     and (p.mvp_role = 'manager' or (p.mvp_role is null and p.hoa_role = 'manager'))
  union
  -- manager not limited to some associations: the whole company
  select a.id
    from public.profiles p
    join public.associations a on a.portfolio_id = p.portfolio_id
   where p.id = auth.uid()
     and (p.mvp_role = 'manager' or (p.mvp_role is null and p.hoa_role = 'manager'))
     and public.manager_is_scoped() is not true
  union
  -- assistant manager: assigned associations, if not disabled
  select a.id
    from public.profiles p
    join public.association_managers am on am.user_id = p.id and am.ended_at is null
    join public.associations a on a.id = am.association_id and a.portfolio_id = p.portfolio_id
   where p.id = auth.uid()
     and p.disabled_at is null
     and p.mvp_role = 'assistant_manager'
  union
  -- active board member
  select bm.association_id
    from public.board_members bm
   where bm.auth_user_id = auth.uid()
     and bm.active = true
     and bm.association_id is not null;
end
$$;
