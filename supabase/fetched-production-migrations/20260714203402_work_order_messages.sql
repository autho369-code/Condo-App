-- Work-order discussion threads (AppFolio parity: in-app messaging beyond ARC).
create table if not exists public.work_order_messages (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  author_id     uuid,
  author_name   text,
  author_role   text not null default 'staff'
                  check (author_role in ('owner','staff','board','vendor')),
  body          text not null,
  created_at    timestamptz not null default now()
);

create index if not exists work_order_messages_wo_idx
  on public.work_order_messages (work_order_id, created_at);

alter table public.work_order_messages enable row level security;

drop policy if exists wo_msg_resident_select on public.work_order_messages;
create policy wo_msg_resident_select on public.work_order_messages
  for select
  using (exists (
    select 1 from public.work_orders wo
    where wo.id = work_order_messages.work_order_id
      and wo.unit_id in (select public.current_resident_unit_ids())
  ));

drop policy if exists wo_msg_resident_insert on public.work_order_messages;
create policy wo_msg_resident_insert on public.work_order_messages
  for insert
  with check (
    author_role = 'owner'
    and public.is_portal_resident()
    and exists (
      select 1 from public.work_orders wo
      where wo.id = work_order_messages.work_order_id
        and wo.unit_id in (select public.current_resident_unit_ids())
    )
  );

drop policy if exists wo_msg_staff_all on public.work_order_messages;
create policy wo_msg_staff_all on public.work_order_messages
  for all
  using (
    public.is_any_staff()
    and exists (
      select 1 from public.work_orders wo
      where wo.id = work_order_messages.work_order_id
    )
  )
  with check (
    public.is_any_staff()
    and exists (
      select 1 from public.work_orders wo
      where wo.id = work_order_messages.work_order_id
    )
  );

drop policy if exists wo_msg_board_select on public.work_order_messages;
create policy wo_msg_board_select on public.work_order_messages
  for select
  using (exists (
    select 1 from public.work_orders wo
    where wo.id = work_order_messages.work_order_id
      and wo.association_id in (select public.current_board_association_ids())
  ));

drop policy if exists wo_msg_board_insert on public.work_order_messages;
create policy wo_msg_board_insert on public.work_order_messages
  for insert
  with check (
    author_role = 'board'
    and exists (
      select 1 from public.work_orders wo
      where wo.id = work_order_messages.work_order_id
        and wo.association_id in (select public.current_board_association_ids())
    )
  );

drop policy if exists wo_msg_vendor_select on public.work_order_messages;
create policy wo_msg_vendor_select on public.work_order_messages
  for select
  using (exists (
    select 1 from public.work_orders wo
    where wo.id = work_order_messages.work_order_id
      and wo.vendor_id = public.current_vendor_id()
  ));

drop policy if exists wo_msg_vendor_insert on public.work_order_messages;
create policy wo_msg_vendor_insert on public.work_order_messages
  for insert
  with check (
    author_role = 'vendor'
    and exists (
      select 1 from public.work_orders wo
      where wo.id = work_order_messages.work_order_id
        and wo.vendor_id = public.current_vendor_id()
    )
  );

drop policy if exists wo_msg_operator_all on public.work_order_messages;
create policy wo_msg_operator_all on public.work_order_messages
  for all
  using (public.is_platform_operator())
  with check (public.is_platform_operator());
;
