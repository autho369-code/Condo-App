-- Staff notes about an owner lived on owners.notes, and the owner and board
-- read policies return whole owner rows, so board members (neighbours) and
-- the owner could read management's notes through the API. Move them to a
-- staff-only table, the same pattern as work_order_private and
-- calendar_event_private: writes to owners.notes keep working (a trigger
-- moves the value), and owners.notes stays empty.

create table if not exists public.owner_private (
  owner_id uuid primary key references public.owners(id) on delete cascade,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.owner_private enable row level security;
revoke all on public.owner_private from anon;
grant select, insert, update, delete on public.owner_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'owner_private' and policyname = 'owner_private_staff') then
    create policy owner_private_staff on public.owner_private
      for all to authenticated
      using (exists (
        select 1 from public.owners o
         where o.id = owner_private.owner_id
           and (public.is_platform_operator()
                or ((public.is_any_staff() or public.is_company_admin())
                    and (o.portfolio_id is null or o.portfolio_id = public.current_portfolio_id())))))
      with check (exists (
        select 1 from public.owners o
         where o.id = owner_private.owner_id
           and (public.is_platform_operator()
                or ((public.is_any_staff() or public.is_company_admin())
                    and (o.portfolio_id is null or o.portfolio_id = public.current_portfolio_id())))));
  end if;
end $$;

-- Updates: move the note before the row is written.
create or replace function public.move_owner_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.notes is not null then
    insert into public.owner_private (owner_id, notes, updated_at)
    values (new.id, nullif(btrim(new.notes), ''), now())
    on conflict (owner_id) do update set notes = excluded.notes, updated_at = now();
    new.notes := null;
  end if;
  return new;
end $$;

-- Inserts: the owner row must exist before the private row can reference it.
create or replace function public.move_owner_private_fields_after_insert()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.notes is not null then
    insert into public.owner_private (owner_id, notes, updated_at)
    values (new.id, nullif(btrim(new.notes), ''), now())
    on conflict (owner_id) do update set notes = excluded.notes, updated_at = now();
    update public.owners set notes = null where id = new.id;
  end if;
  return null;
end $$;

revoke all on function public.move_owner_private_fields() from public, anon, authenticated;
revoke all on function public.move_owner_private_fields_after_insert() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'owners_move_private_fields' and tgrelid = 'public.owners'::regclass) then
    create trigger owners_move_private_fields before update of notes on public.owners
      for each row execute function public.move_owner_private_fields();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'owners_move_private_fields_insert' and tgrelid = 'public.owners'::regclass) then
    create trigger owners_move_private_fields_insert after insert on public.owners
      for each row execute function public.move_owner_private_fields_after_insert();
  end if;
end $$;

-- Existing notes (none in production on 2026-10-04) move over too.
insert into public.owner_private (owner_id, notes)
select id, notes from public.owners where notes is not null
on conflict (owner_id) do nothing;
update public.owners set notes = null where notes is not null;
