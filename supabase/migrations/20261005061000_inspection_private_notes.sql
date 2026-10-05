-- inspections.notes is a staff field ("Notes" on the staff inspection forms),
-- but residents of the unit and the inspecting vendor can read inspection rows.
-- Move it to a staff-only side table, same pattern as
-- 20261004200000_staff_private_notes.sql. No existing inspection has notes
-- (checked), so there is nothing to backfill. Additive: no column is dropped.

create table if not exists public.inspection_private (
  inspection_id uuid primary key references public.inspections(id) on delete cascade deferrable initially deferred,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.inspection_private enable row level security;
revoke all on public.inspection_private from anon;
grant select, insert, update, delete on public.inspection_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inspection_private' and policyname = 'inspection_private_staff') then
    create policy inspection_private_staff on public.inspection_private
      for all to authenticated
      using (exists (
        select 1 from public.inspections i
         where i.id = inspection_private.inspection_id
           and (public.is_platform_operator()
                or ((public.is_any_staff() or public.is_company_admin()) and public.can_access_association(i.association_id)))))
      with check (exists (
        select 1 from public.inspections i
         where i.id = inspection_private.inspection_id
           and (public.is_platform_operator()
                or ((public.is_any_staff() or public.is_company_admin()) and public.can_access_association(i.association_id)))));
  end if;
  -- Association-scoped managers see only their associations' notes.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inspection_private' and policyname = 'mgr_assoc_scope') then
    create policy mgr_assoc_scope on public.inspection_private
      as restrictive for all to authenticated
      using (exists (
        select 1 from public.inspections i
         where i.id = inspection_private.inspection_id
           and public.can_view_association_row(i.association_id)));
  end if;
end $$;

create or replace function public.move_inspection_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if public.is_self_service_caller() then
    -- Residents, board members and vendors never write management's notes.
    new.notes := null;
    return new;
  end if;
  if new.notes is not null then
    insert into public.inspection_private (inspection_id, notes, updated_at)
    values (new.id, nullif(btrim(new.notes), ''), now())
    on conflict (inspection_id) do update set
      notes = excluded.notes,
      updated_at = now();
    new.notes := null;
  end if;
  return new;
end $$;

revoke all on function public.move_inspection_private_fields() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'inspections_move_private_fields' and tgrelid = 'public.inspections'::regclass) then
    create trigger inspections_move_private_fields before insert or update of notes on public.inspections
      for each row execute function public.move_inspection_private_fields();
  end if;
end $$;
