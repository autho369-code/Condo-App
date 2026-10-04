-- associations.description was labelled "Description / internal notes" on the
-- association settings form, and every owner, tenant, board member and vendor
-- in the association reads association rows. No owner, board or vendor screen
-- shows it, so it joins management_end_reason in the staff-only
-- association_private table (see 20261004200000_staff_private_notes.sql).
-- Writes to associations.description keep working: the trigger moves them.

alter table public.association_private add column if not exists description text;

create or replace function public.move_association_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and public.is_self_service_caller() then
    -- Owners, tenants, board members and vendors never write management's notes.
    new.management_end_reason := null;
    new.maintenance_notes := null;
    new.description := null;
    return new;
  end if;
  if new.management_end_reason is not null or new.description is not null then
    insert into public.association_private (association_id, management_end_reason, description, updated_at)
    values (new.id, nullif(btrim(new.management_end_reason), ''), nullif(btrim(new.description), ''), now())
    on conflict (association_id) do update set
      management_end_reason = case when new.management_end_reason is not null then excluded.management_end_reason else public.association_private.management_end_reason end,
      description = case when new.description is not null then excluded.description else public.association_private.description end,
      updated_at = now();
    new.management_end_reason := null;
    new.description := null;
  end if;
  if new.maintenance_notes is not null then
    insert into public.association_vendor_private (association_id, maintenance_notes, updated_at)
    values (new.id, nullif(btrim(new.maintenance_notes), ''), now())
    on conflict (association_id) do update set
      maintenance_notes = excluded.maintenance_notes,
      updated_at = now();
    new.maintenance_notes := null;
  end if;
  return new;
end $$;

revoke all on function public.move_association_private_fields() from public, anon, authenticated;

-- The trigger fires only on the columns it lists, so add description.
do $$
begin
  if exists (select 1 from pg_trigger t
              where t.tgname = 'associations_move_private_fields' and t.tgrelid = 'public.associations'::regclass
                and not exists (select 1 from unnest(t.tgattr::int2[]) a(attnum)
                                 join pg_attribute pa on pa.attrelid = t.tgrelid and pa.attnum = a.attnum
                                where pa.attname = 'description')) then
    execute 'create or replace trigger associations_move_private_fields before insert or update of management_end_reason, maintenance_notes, description on public.associations for each row execute function public.move_association_private_fields()';
  end if;
end $$;

-- Existing descriptions (1 in production on 2026-10-04) move over.
insert into public.association_private (association_id, description)
select id, nullif(btrim(description), '') from public.associations where description is not null
on conflict (association_id) do update set description = excluded.description, updated_at = now();
update public.associations set description = null where description is not null;
