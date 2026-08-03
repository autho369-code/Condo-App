-- Keep confidential meeting governance data limited to assigned staff and
-- active board members. The broader association-read helper intentionally
-- includes current owners for resident-facing features and must not be used
-- for board packets, executive-session agendas, or follow-up actions.

create or replace function public.can_access_confidential_meeting_mvp(a_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select a_id is not null
    and public.is_current_identity_enabled()
    and (
      public.can_edit_association_mvp(a_id)
      or exists (
        select 1
        from public.profiles p
        join public.association_managers am
          on am.user_id = p.id
         and am.association_id = a_id
         and am.ended_at is null
        join public.associations a
          on a.id = am.association_id
         and a.portfolio_id = p.portfolio_id
        where p.id = auth.uid()
          and p.disabled_at is null
          and p.mvp_role = 'assistant_manager'
      )
      or exists (
        select 1
        from public.board_members bm
        where bm.auth_user_id = auth.uid()
          and bm.association_id = a_id
          and bm.active = true
      )
    );
$$;

comment on function public.can_access_confidential_meeting_mvp(uuid) is
  'Confidential meeting read boundary for operators, authorized management staff, and active board members. Explicitly excludes owners, tenants, and vendors.';

revoke all on function public.can_access_confidential_meeting_mvp(uuid) from public, anon;
grant execute on function public.can_access_confidential_meeting_mvp(uuid) to authenticated, service_role;

drop policy if exists agenda_items_staff_select on public.agenda_items;
create policy agenda_items_staff_select
on public.agenda_items
for select to authenticated
using (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = agenda_items.meeting_id
      and public.can_access_portfolio(m.portfolio_id)
      and public.can_access_confidential_meeting_mvp(m.association_id)
  )
);

drop policy if exists meeting_documents_staff_select on public.meeting_documents;
create policy meeting_documents_staff_select
on public.meeting_documents
for select to authenticated
using (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = meeting_documents.meeting_id
      and public.can_access_portfolio(m.portfolio_id)
      and public.can_access_confidential_meeting_mvp(m.association_id)
  )
);

drop policy if exists meeting_action_items_staff_select on public.meeting_action_items;
create policy meeting_action_items_staff_select
on public.meeting_action_items
for select to authenticated
using (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = meeting_action_items.meeting_id
      and public.can_access_portfolio(m.portfolio_id)
      and public.can_access_confidential_meeting_mvp(m.association_id)
  )
);
