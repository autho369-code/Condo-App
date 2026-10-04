-- Codex review of #191: owners_move_private_fields runs before
-- trg_owners_000_self_service_guard (triggers fire in name order), so an
-- owner updating their own owners.notes had the value written to
-- owner_private before the guard restored the row. Drop a self-service
-- caller's value instead, as every other private-field trigger does.
create or replace function public.move_owner_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if public.is_self_service_caller() then
    -- Owners, tenants, board members and vendors never write management's notes.
    new.notes := null;
    return new;
  end if;
  if new.notes is not null then
    insert into public.owner_private (owner_id, notes, updated_at)
    values (new.id, nullif(btrim(new.notes), ''), now())
    on conflict (owner_id) do update set notes = excluded.notes, updated_at = now();
    new.notes := null;
  end if;
  return new;
end $$;

create or replace function public.move_owner_private_fields_after_insert()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.notes is not null then
    if not public.is_self_service_caller() then
      insert into public.owner_private (owner_id, notes, updated_at)
      values (new.id, nullif(btrim(new.notes), ''), now())
      on conflict (owner_id) do update set notes = excluded.notes, updated_at = now();
    end if;
    update public.owners set notes = null where id = new.id;
  end if;
  return null;
end $$;

revoke all on function public.move_owner_private_fields() from public, anon, authenticated;
revoke all on function public.move_owner_private_fields_after_insert() from public, anon, authenticated;
