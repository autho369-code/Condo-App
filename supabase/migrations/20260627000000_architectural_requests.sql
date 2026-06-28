-- Architectural Review Requests (ARC).
--
-- Until now the only ARC surface was architectural_review_settings (manager
-- config) and a board page that *faked* requests by text-matching the violations
-- table. There was no real entity, no homeowner submission path, and no in-app
-- messaging — AppFolio's signature ARC capability. This adds:
--   1. architectural_requests          — the homeowner's request + board decision
--   2. architectural_request_messages  — the in-app discussion thread
-- RLS mirrors amenity_reservations (owner submits, staff manage, board views,
-- operator full). Idempotent per project convention.

-- ── 1. Requests ─────────────────────────────────────────────────────────────
create table if not exists public.architectural_requests (
  id              uuid primary key default gen_random_uuid(),
  association_id  uuid not null,
  portfolio_id    uuid,
  unit_id         uuid,
  owner_id        uuid,                       -- homeowner who submitted
  submitted_by    uuid,                       -- auth.uid()
  committee_id    uuid references public.committees(id) on delete set null,
  title           text not null,
  description     text not null,
  category        text not null default 'other'
                    check (category in (
                      'exterior_paint','fence','landscaping','roof','addition',
                      'deck_patio','windows_doors','solar','pool','other')),
  status          text not null default 'submitted'
                    check (status in (
                      'submitted','under_review','more_info','approved',
                      'denied','withdrawn')),
  decision_notes  text,
  decided_by      uuid,
  decided_at      timestamptz,
  attachments     jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists architectural_requests_assoc_status_idx
  on public.architectural_requests (association_id, status);
create index if not exists architectural_requests_owner_idx
  on public.architectural_requests (owner_id);

do $$ begin
  alter table public.architectural_requests
    add constraint architectural_requests_association_id_fkey
    foreign key (association_id) references public.associations(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.architectural_requests
    add constraint architectural_requests_unit_id_fkey
    foreign key (unit_id) references public.units(id) on delete set null;
exception when duplicate_object then null; end $$;

-- owner_id FK so PostgREST can embed owners(full_name) in the manager/board queues.
do $$ begin
  alter table public.architectural_requests
    add constraint architectural_requests_owner_id_fkey
    foreign key (owner_id) references public.owners(id) on delete set null;
exception when duplicate_object then null; end $$;

alter table public.architectural_requests enable row level security;

create or replace function public.architectural_requests_touch_updated_at()
returns trigger language plpgsql
set search_path to 'pg_catalog', 'public' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_architectural_requests_updated_at on public.architectural_requests;
create trigger trg_architectural_requests_updated_at
  before update on public.architectural_requests
  for each row execute function public.architectural_requests_touch_updated_at();

-- Residents: see their own requests.
drop policy if exists arch_req_resident_select on public.architectural_requests;
create policy arch_req_resident_select on public.architectural_requests
  for select
  using (owner_id = public.current_owner_id());

-- Residents: submit a request for self, in one of their associations.
drop policy if exists arch_req_resident_insert on public.architectural_requests;
create policy arch_req_resident_insert on public.architectural_requests
  for insert
  with check (
    public.is_portal_resident()
    and owner_id = public.current_owner_id()
    and association_id in (select public.current_resident_association_ids())
    and status = 'submitted'
  );

-- Residents: withdraw their own open request (may only set status = withdrawn).
drop policy if exists arch_req_resident_withdraw on public.architectural_requests;
create policy arch_req_resident_withdraw on public.architectural_requests
  for update
  using (
    owner_id = public.current_owner_id()
    and status in ('submitted','under_review','more_info')
  )
  with check (
    owner_id = public.current_owner_id()
    and status = 'withdrawn'
  );

-- Staff: full control, scoped to associations they can access.
drop policy if exists arch_req_staff_all on public.architectural_requests;
create policy arch_req_staff_all on public.architectural_requests
  for all
  using (public.can_access_association(association_id))
  with check (public.can_access_association(association_id));

-- Board: view requests for their associations.
drop policy if exists arch_req_board_select on public.architectural_requests;
create policy arch_req_board_select on public.architectural_requests
  for select
  using (association_id in (select public.current_board_association_ids()));

-- Platform operator: full.
drop policy if exists arch_req_operator_all on public.architectural_requests;
create policy arch_req_operator_all on public.architectural_requests
  for all
  using (public.is_platform_operator())
  with check (public.is_platform_operator());

-- ── 2. Messages (in-app discussion thread) ──────────────────────────────────
create table if not exists public.architectural_request_messages (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.architectural_requests(id) on delete cascade,
  author_id    uuid,                          -- auth.uid()
  author_name  text,
  author_role  text not null default 'staff'
                 check (author_role in ('owner','staff','board')),
  body         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists arch_req_messages_request_idx
  on public.architectural_request_messages (request_id, created_at);

alter table public.architectural_request_messages enable row level security;

-- A message is visible / writable to whoever can see the parent request.
-- Residents: read + post on their own requests.
drop policy if exists arch_msg_resident_select on public.architectural_request_messages;
create policy arch_msg_resident_select on public.architectural_request_messages
  for select
  using (exists (
    select 1 from public.architectural_requests r
    where r.id = architectural_request_messages.request_id
      and r.owner_id = public.current_owner_id()
  ));

drop policy if exists arch_msg_resident_insert on public.architectural_request_messages;
create policy arch_msg_resident_insert on public.architectural_request_messages
  for insert
  with check (
    author_role = 'owner'
    and exists (
      select 1 from public.architectural_requests r
      where r.id = architectural_request_messages.request_id
        and r.owner_id = public.current_owner_id()
    )
  );

-- Staff: read + post on accessible associations.
drop policy if exists arch_msg_staff_all on public.architectural_request_messages;
create policy arch_msg_staff_all on public.architectural_request_messages
  for all
  using (exists (
    select 1 from public.architectural_requests r
    where r.id = architectural_request_messages.request_id
      and public.can_access_association(r.association_id)
  ))
  with check (exists (
    select 1 from public.architectural_requests r
    where r.id = architectural_request_messages.request_id
      and public.can_access_association(r.association_id)
  ));

-- Board: read + post on their associations.
drop policy if exists arch_msg_board_select on public.architectural_request_messages;
create policy arch_msg_board_select on public.architectural_request_messages
  for select
  using (exists (
    select 1 from public.architectural_requests r
    where r.id = architectural_request_messages.request_id
      and r.association_id in (select public.current_board_association_ids())
  ));

drop policy if exists arch_msg_board_insert on public.architectural_request_messages;
create policy arch_msg_board_insert on public.architectural_request_messages
  for insert
  with check (
    author_role = 'board'
    and exists (
      select 1 from public.architectural_requests r
      where r.id = architectural_request_messages.request_id
        and r.association_id in (select public.current_board_association_ids())
    )
  );

-- Platform operator: full.
drop policy if exists arch_msg_operator_all on public.architectural_request_messages;
create policy arch_msg_operator_all on public.architectural_request_messages
  for all
  using (public.is_platform_operator())
  with check (public.is_platform_operator());

-- ── 3. Wire the manager workload count to the real table ─────────────────────
-- Replaces the hardcoded `0 AS open_arch_reviews` placeholder.
create or replace view public.v_manager_workload as
select
  pr.id as manager_id,
  pr.full_name as manager_name,
  pr.email as manager_email,
  count(distinct am.association_id) as assigned_associations,
  coalesce(sum(a.unit_count), 0) as total_doors_managed,
  count(distinct wo.id) filter (
    where wo.status in ('new', 'in_progress', 'scheduled')
  ) as open_work_orders,
  count(distinct wo.id) filter (
    where wo.status in ('new', 'in_progress', 'scheduled')
      and wo.scheduled_date < current_date
  ) as overdue_work_orders,
  count(distinct vc.id) filter (
    where vc.status not in ('closed', 'violation_dismissed') and vc.archived_at is null
  ) as open_violations,
  count(distinct ar.id) filter (
    where ar.status in ('submitted', 'under_review', 'more_info')
  )::integer as open_arch_reviews,
  au.last_sign_in_at as last_login
from public.profiles pr
join public.association_managers am on am.user_id = pr.id and am.ended_at is null
join public.associations a on a.id = am.association_id and a.archived_at is null
left join public.work_orders wo on wo.association_id = a.id and wo.archived_at is null
left join public.violation_cases vc on vc.association_id = a.id
left join public.architectural_requests ar on ar.association_id = a.id
left join auth.users au on au.id = pr.id
where pr.hoa_role in ('manager', 'company_admin')
  or exists (
    select 1 from public.user_roles ur
    where ur.id = pr.role_id
      and ur.name in ('President', 'Property Manager', 'Accountant')
  )
group by pr.id, pr.full_name, pr.email, au.last_sign_in_at;
