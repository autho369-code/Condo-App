-- Amenity reservations: residents request, managers approve/deny, board views.
-- The "bookable" flag already exists on association_amenities as
-- `allow_reservations` (boolean, default false) and is written by the amenity
-- settings page; we reuse it as the single source of truth rather than adding a
-- redundant `bookable` column. (Kept idempotent per project convention.)
alter table public.association_amenities
  add column if not exists allow_reservations boolean not null default false;

create table if not exists public.amenity_reservations (
  id              uuid primary key default gen_random_uuid(),
  amenity_id      uuid not null references public.association_amenities(id) on delete cascade,
  association_id  uuid not null,
  portfolio_id    uuid,
  unit_id         uuid,
  owner_id        uuid,
  reserved_by     uuid,                       -- auth.uid()
  reserved_for_name text,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  party_size      int,
  status          text not null default 'pending'
                    check (status in ('pending','approved','denied','cancelled')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists amenity_reservations_assoc_start_idx
  on public.amenity_reservations (association_id, start_time);
create index if not exists amenity_reservations_owner_idx
  on public.amenity_reservations (owner_id);

-- FKs so PostgREST can embed association/unit names, and for integrity.
do $$ begin
  alter table public.amenity_reservations
    add constraint amenity_reservations_association_id_fkey
    foreign key (association_id) references public.associations(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.amenity_reservations
    add constraint amenity_reservations_unit_id_fkey
    foreign key (unit_id) references public.units(id) on delete set null;
exception when duplicate_object then null; end $$;

alter table public.amenity_reservations enable row level security;

-- keep updated_at fresh
create or replace function public.amenity_reservations_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_amenity_reservations_updated_at on public.amenity_reservations;
create trigger trg_amenity_reservations_updated_at
  before update on public.amenity_reservations
  for each row execute function public.amenity_reservations_touch_updated_at();

-- ── Residents ──────────────────────────────────────────────────────────────
-- See only their own reservations.
drop policy if exists amenity_res_resident_select on public.amenity_reservations;
create policy amenity_res_resident_select on public.amenity_reservations
  for select
  using (owner_id = public.current_owner_id());

-- Request a reservation: only for self, in one of their associations, pending.
drop policy if exists amenity_res_resident_insert on public.amenity_reservations;
create policy amenity_res_resident_insert on public.amenity_reservations
  for insert
  with check (
    public.is_portal_resident()
    and owner_id = public.current_owner_id()
    and association_id in (select public.current_resident_association_ids())
    and status = 'pending'
  );

-- Cancel their own pending/approved reservation (may only set it to cancelled).
drop policy if exists amenity_res_resident_cancel on public.amenity_reservations;
create policy amenity_res_resident_cancel on public.amenity_reservations
  for update
  using (
    owner_id = public.current_owner_id()
    and status in ('pending','approved')
  )
  with check (
    owner_id = public.current_owner_id()
    and status = 'cancelled'
  );

-- ── Staff (managers etc.) ───────────────────────────────────────────────────
-- Full control, scoped to associations they can access. Mirrors the
-- association_amenities staff policy (can_access_association).
drop policy if exists amenity_res_staff_all on public.amenity_reservations;
create policy amenity_res_staff_all on public.amenity_reservations
  for all
  using (public.can_access_association(association_id))
  with check (public.can_access_association(association_id));

-- ── Board ───────────────────────────────────────────────────────────────────
drop policy if exists amenity_res_board_select on public.amenity_reservations;
create policy amenity_res_board_select on public.amenity_reservations
  for select
  using (association_id in (select public.current_board_association_ids()));

-- ── Platform operator ───────────────────────────────────────────────────────
drop policy if exists amenity_res_operator_all on public.amenity_reservations;
create policy amenity_res_operator_all on public.amenity_reservations
  for all
  using (public.is_platform_operator())
  with check (public.is_platform_operator());
