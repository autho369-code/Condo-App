-- Secure and complete the meeting-governance workspace.
--
-- The production baseline contained three incompatible fragments:
--   * structured agendas and meeting documents were readable by boards but had
--     no staff policy, so the management UI could not persist either record;
--   * the agenda reorder RPC used portfolio-wide staff authorization instead
--     of the assigned-association write boundary; and
--   * meeting_action_items was an unused integer-ID prototype even though live
--     meetings use UUIDs.  The hard guard below prevents an accidental rewrite
--     if an environment contains legacy action-item data.

-- Keep the canonical association helpers compatible with both the current
-- mvp_role model and the legacy hoa_role identities that are still active in
-- production.  A legacy manager remains limited to explicit assignments.
create or replace function public.can_access_association_mvp(a_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
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
            p.mvp_role in ('manager', 'assistant_manager')
            or (p.mvp_role is null and p.hoa_role = 'manager')
          )
          and a.id = a_id
      )
      or exists (
        select 1
        from public.board_members bm
        where bm.auth_user_id = auth.uid()
          and bm.association_id = a_id
          and bm.active = true
      )
      or exists (
        select 1
        from public.occupancies oc
        join public.units u on u.id = oc.unit_id
        join public.buildings b on b.id = u.building_id
        join public.owners o on o.id = oc.owner_id
        where b.association_id = a_id
          and o.auth_user_id = auth.uid()
          and oc.status = 'current'
      )
    );
$$;

create or replace function public.can_edit_association_mvp(a_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
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
    );
$$;

comment on function public.can_access_association_mvp(uuid) is
  'Role-aware association read boundary. Supports current mvp_role identities and assigned legacy hoa_role staff.';
comment on function public.can_edit_association_mvp(uuid) is
  'Association write boundary for operators, portfolio company admins/accountants, and assigned managers. Assistant managers and portal users remain read-only.';

-- Meetings and attendance previously used portfolio-wide mutation policies.
-- Use the role-aware association boundary and prove the portfolio/association
-- pair is internally consistent on every write.
drop policy if exists meetings_staff_delete on public.meetings;
drop policy if exists meetings_staff_insert on public.meetings;
drop policy if exists meetings_staff_update on public.meetings;

create policy meetings_staff_delete
on public.meetings
for delete to authenticated
using (
  public.can_edit_association_mvp(association_id)
  and exists (
    select 1 from public.associations a
    where a.id = meetings.association_id
      and a.portfolio_id = meetings.portfolio_id
  )
);

create policy meetings_staff_insert
on public.meetings
for insert to authenticated
with check (
  public.can_edit_association_mvp(association_id)
  and exists (
    select 1 from public.associations a
    where a.id = meetings.association_id
      and a.portfolio_id = meetings.portfolio_id
  )
);

create policy meetings_staff_update
on public.meetings
for update to authenticated
using (
  public.can_edit_association_mvp(association_id)
  and exists (
    select 1 from public.associations a
    where a.id = meetings.association_id
      and a.portfolio_id = meetings.portfolio_id
  )
)
with check (
  public.can_edit_association_mvp(association_id)
  and exists (
    select 1 from public.associations a
    where a.id = meetings.association_id
      and a.portfolio_id = meetings.portfolio_id
  )
);

drop policy if exists meeting_attendees_staff_delete on public.meeting_attendees;
drop policy if exists meeting_attendees_staff_insert on public.meeting_attendees;
drop policy if exists meeting_attendees_staff_update on public.meeting_attendees;

create policy meeting_attendees_staff_delete
on public.meeting_attendees
for delete to authenticated
using (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = meeting_attendees.meeting_id
      and public.can_edit_association_mvp(m.association_id)
  )
);

create policy meeting_attendees_staff_insert
on public.meeting_attendees
for insert to authenticated
with check (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = meeting_attendees.meeting_id
      and public.can_edit_association_mvp(m.association_id)
  )
);

create policy meeting_attendees_staff_update
on public.meeting_attendees
for update to authenticated
using (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = meeting_attendees.meeting_id
      and public.can_edit_association_mvp(m.association_id)
  )
)
with check (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = meeting_attendees.meeting_id
      and public.can_edit_association_mvp(m.association_id)
  )
);

-- Structured agenda rows: assigned staff may read, but only full meeting
-- editors may change a non-finalized agenda. Board read remains covered by the
-- existing agenda_items_board_read policy.
drop policy if exists agenda_items_staff_select on public.agenda_items;
drop policy if exists agenda_items_staff_insert on public.agenda_items;
drop policy if exists agenda_items_staff_update on public.agenda_items;
drop policy if exists agenda_items_staff_delete on public.agenda_items;

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
      and public.can_access_association_mvp(m.association_id)
  )
);

create policy agenda_items_staff_insert
on public.agenda_items
for insert to authenticated
with check (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = agenda_items.meeting_id
      and m.status not in ('completed', 'cancelled')
      and public.can_edit_association_mvp(m.association_id)
  )
);

create policy agenda_items_staff_update
on public.agenda_items
for update to authenticated
using (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = agenda_items.meeting_id
      and m.status not in ('completed', 'cancelled')
      and public.can_edit_association_mvp(m.association_id)
  )
)
with check (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = agenda_items.meeting_id
      and m.status not in ('completed', 'cancelled')
      and public.can_edit_association_mvp(m.association_id)
  )
);

create policy agenda_items_staff_delete
on public.agenda_items
for delete to authenticated
using (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = agenda_items.meeting_id
      and m.status not in ('completed', 'cancelled')
      and public.can_edit_association_mvp(m.association_id)
  )
);

-- Meeting documents remain in a private bucket. The application signs reads
-- server-side after this metadata RLS check; no broad storage.objects policy is
-- introduced.
alter table public.meeting_documents
  drop constraint if exists meeting_documents_scoped_path_check;
alter table public.meeting_documents
  add constraint meeting_documents_scoped_path_check
  check (
    storage_path ~ ('^meetings/' || meeting_id::text || '/[^/]+$')
  );

drop policy if exists meeting_documents_staff_select on public.meeting_documents;
drop policy if exists meeting_documents_staff_insert on public.meeting_documents;
drop policy if exists meeting_documents_staff_update on public.meeting_documents;
drop policy if exists meeting_documents_staff_delete on public.meeting_documents;

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
      and public.can_access_association_mvp(m.association_id)
  )
);

create policy meeting_documents_staff_insert
on public.meeting_documents
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = meeting_documents.meeting_id
      and public.can_edit_association_mvp(m.association_id)
  )
);

create policy meeting_documents_staff_update
on public.meeting_documents
for update to authenticated
using (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = meeting_documents.meeting_id
      and public.can_edit_association_mvp(m.association_id)
  )
)
with check (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = meeting_documents.meeting_id
      and public.can_edit_association_mvp(m.association_id)
  )
);

create policy meeting_documents_staff_delete
on public.meeting_documents
for delete to authenticated
using (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = meeting_documents.meeting_id
      and public.can_edit_association_mvp(m.association_id)
  )
);

-- The legacy table has never been writable and production contains zero rows.
-- Abort rather than reinterpret data if another environment differs.
do $$
begin
  if exists (select 1 from public.meeting_action_items limit 1) then
    raise exception 'meeting_action_items contains legacy rows; migrate them explicitly before applying this release';
  end if;
end;
$$;

-- Transform the empty prototype in place so migration tooling and dependency
-- audits do not need to treat this as a destructive table replacement.
alter table public.meeting_action_items
  drop constraint meeting_action_items_pkey;
alter table public.meeting_action_items
  alter column id drop default;
drop sequence if exists public.meeting_action_items_id_seq;
alter table public.meeting_action_items
  alter column id drop not null,
  alter column id type uuid using null;
alter table public.meeting_action_items
  alter column id set default gen_random_uuid(),
  alter column id set not null;

alter table public.meeting_action_items
  alter column "meetingId" drop not null,
  alter column "meetingId" type uuid using null;
alter table public.meeting_action_items
  alter column "meetingId" set not null;
alter table public.meeting_action_items
  alter column "assignedToId" type uuid using null;
alter table public.meeting_action_items
  alter column "dueDate" type date using "dueDate"::date;
alter table public.meeting_action_items
  alter column "completedAt" type timestamptz using "completedAt" at time zone 'UTC';
alter table public.meeting_action_items
  alter column "createdAt" type timestamptz using "createdAt" at time zone 'UTC';

alter table public.meeting_action_items rename column "meetingId" to meeting_id;
alter table public.meeting_action_items rename column "assignedToId" to assigned_to_user_id;
alter table public.meeting_action_items rename column "dueDate" to due_date;
alter table public.meeting_action_items rename column "completedAt" to completed_at;
alter table public.meeting_action_items rename column "createdAt" to created_at;
alter table public.meeting_action_items drop column "isCompleted";

alter table public.meeting_action_items
  add column description text,
  add column assigned_to text,
  add column status text not null default 'open',
  add column completed_by uuid references auth.users(id) on delete set null,
  add column created_by uuid references auth.users(id) on delete set null,
  add column updated_at timestamptz not null default now(),
  add constraint meeting_action_items_pkey primary key (id),
  add constraint meeting_action_items_meeting_fkey
    foreign key (meeting_id) references public.meetings(id) on delete cascade,
  add constraint meeting_action_items_assigned_user_fkey
    foreign key (assigned_to_user_id) references public.profiles(id) on delete set null,
  add constraint meeting_action_items_title_check
    check (char_length(btrim(title)) between 1 and 255),
  add constraint meeting_action_items_description_check
    check (description is null or char_length(description) <= 5000),
  add constraint meeting_action_items_assigned_to_check
    check (assigned_to is null or char_length(assigned_to) <= 200),
  add constraint meeting_action_items_status_check
    check (status in ('open', 'in_progress', 'blocked', 'completed', 'cancelled')),
  add constraint meeting_action_items_completion_check
    check (
      (status = 'completed' and completed_at is not null)
      or (status <> 'completed' and completed_at is null)
    );

create index meeting_action_items_meeting_status_due_idx
  on public.meeting_action_items (meeting_id, status, due_date);

alter table public.meeting_action_items enable row level security;

create policy meeting_action_items_operator_all
on public.meeting_action_items
to authenticated
using (public.is_platform_operator())
with check (public.is_platform_operator());

create policy meeting_action_items_board_read
on public.meeting_action_items
for select to authenticated
using (
  exists (
    select 1
    from public.meetings m
    where m.id = meeting_action_items.meeting_id
      and m.association_id in (select public.current_board_association_ids())
  )
);

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
      and public.can_access_association_mvp(m.association_id)
  )
);

create policy meeting_action_items_staff_insert
on public.meeting_action_items
for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = meeting_action_items.meeting_id
      and public.can_edit_association_mvp(m.association_id)
  )
);

create policy meeting_action_items_staff_update
on public.meeting_action_items
for update to authenticated
using (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = meeting_action_items.meeting_id
      and public.can_edit_association_mvp(m.association_id)
  )
)
with check (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = meeting_action_items.meeting_id
      and public.can_edit_association_mvp(m.association_id)
  )
);

create policy meeting_action_items_staff_delete
on public.meeting_action_items
for delete to authenticated
using (
  exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = meeting_action_items.meeting_id
      and public.can_edit_association_mvp(m.association_id)
  )
);

grant select, insert, update, delete on public.meeting_action_items to authenticated;
grant all on public.meeting_action_items to service_role;
revoke all on public.meeting_action_items from anon;

-- Reordering must be a complete permutation of the meeting agenda and must use
-- the same assigned-association write boundary as row mutations.
create or replace function public.reorder_agenda_items(
  p_meeting_id uuid,
  p_item_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_association_id uuid;
  v_status public.meeting_status;
  v_item_count integer;
  v_updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_meeting_id is null
     or p_item_ids is null
     or cardinality(p_item_ids) not between 1 and 500
     or exists (select 1 from unnest(p_item_ids) as item(item_id) where item.item_id is null)
     or (select count(distinct item.item_id) from unnest(p_item_ids) as item(item_id))
        <> cardinality(p_item_ids) then
    raise exception 'Invalid agenda ordering input' using errcode = '22023';
  end if;

  select m.association_id, m.status
  into v_association_id, v_status
  from public.meetings m
  join public.associations a
    on a.id = m.association_id
   and a.portfolio_id = m.portfolio_id
  where m.id = p_meeting_id;

  if not found then
    raise exception 'Meeting not found or tenant scope is invalid' using errcode = 'P0002';
  end if;
  if not public.can_edit_association_mvp(v_association_id) then
    raise exception 'Meeting editor authorization required' using errcode = '42501';
  end if;
  if v_status in ('completed', 'cancelled') then
    raise exception 'A finalized meeting agenda cannot be reordered' using errcode = '55000';
  end if;

  perform 1
  from public.agenda_items ai
  where ai.meeting_id = p_meeting_id
  for update;

  select count(*)::integer
  into v_item_count
  from public.agenda_items ai
  where ai.meeting_id = p_meeting_id;

  if v_item_count <> cardinality(p_item_ids)
     or exists (
       select 1
       from unnest(p_item_ids) as requested(item_id)
       left join public.agenda_items ai
         on ai.id = requested.item_id
        and ai.meeting_id = p_meeting_id
       where ai.id is null
     ) then
    raise exception 'Agenda ordering must include every item exactly once' using errcode = '23514';
  end if;

  update public.agenda_items ai
  set sort_order = (ordered.ordinal - 1)::integer,
      updated_at = now()
  from unnest(p_item_ids) with ordinality as ordered(item_id, ordinal)
  where ai.id = ordered.item_id
    and ai.meeting_id = p_meeting_id;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> cardinality(p_item_ids) then
    raise exception 'Agenda ordering changed concurrently' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.reorder_agenda_items(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_agenda_items(uuid, uuid[]) to authenticated, service_role;
