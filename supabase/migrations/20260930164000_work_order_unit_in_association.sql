-- A work order's unit must belong to the work order's association. The New
-- work order form (and the API) accepted the two independently, so a work
-- order could point at another association's unit and be authorized, charged
-- back and reported against the wrong association. No existing rows violate
-- this (checked before applying).
create or replace function public.work_order_unit_in_association()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.unit_id is not null
     and (tg_op = 'INSERT' or new.unit_id is distinct from old.unit_id or new.association_id is distinct from old.association_id)
     and not exists (select 1 from public.units u join public.buildings b on b.id = u.building_id
                      where u.id = new.unit_id and b.association_id = new.association_id) then
    raise exception 'That unit is not in the selected association' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_work_order_unit_in_association on public.work_orders;
create trigger trg_work_order_unit_in_association before insert or update of unit_id, association_id on public.work_orders
  for each row execute function public.work_order_unit_in_association();
