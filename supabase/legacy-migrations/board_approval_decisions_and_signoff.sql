-- Per-board-member digital sign-off records for approval requests.
create table if not exists public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  board_member_id uuid references public.board_members(id),
  decided_by uuid,
  decision text not null check (decision in ('approve','reject','abstain')),
  signature_name text,
  comment text,
  decided_at timestamptz not null default now(),
  unique (approval_request_id, decided_by)
);

create index if not exists approval_decisions_request_idx on public.approval_decisions(approval_request_id);

alter table public.approval_decisions enable row level security;

-- SELECT: staff (via parent portfolio), board (parent association), platform operator.
drop policy if exists approval_decisions_select on public.approval_decisions;
create policy approval_decisions_select on public.approval_decisions
  for select
  using (
    is_platform_operator()
    or exists (
      select 1 from public.approval_requests r
      where r.id = approval_decisions.approval_request_id
        and (
          can_access_portfolio(r.portfolio_id)
          or (is_board_user() and r.association_id in (select current_board_association_ids()))
        )
    )
  );

-- INSERT: board member casting their own decision on a request for their association.
drop policy if exists approval_decisions_board_insert on public.approval_decisions;
create policy approval_decisions_board_insert on public.approval_decisions
  for insert
  with check (
    decided_by = auth.uid()
    and exists (
      select 1 from public.approval_requests r
      where r.id = approval_decisions.approval_request_id
        and r.association_id in (select current_board_association_ids())
    )
  );

-- UPDATE: board member changing their own decision on a request for their association.
drop policy if exists approval_decisions_board_update on public.approval_decisions;
create policy approval_decisions_board_update on public.approval_decisions
  for update
  using (
    decided_by = auth.uid()
    and exists (
      select 1 from public.approval_requests r
      where r.id = approval_decisions.approval_request_id
        and r.association_id in (select current_board_association_ids())
    )
  )
  with check (
    decided_by = auth.uid()
    and exists (
      select 1 from public.approval_requests r
      where r.id = approval_decisions.approval_request_id
        and r.association_id in (select current_board_association_ids())
    )
  );
