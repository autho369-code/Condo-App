-- 1. A scheduled move-out ends portal access when the date arrives. An owner
--    occupancy whose move_out_date has passed keeps status 'current' until
--    someone edits it, so the resident helpers (used by every owner read
--    policy) kept treating the former owner as a resident of the unit and its
--    association. They now also require the move-out date not to have
--    arrived (current_date is America/Chicago, the database time zone).
create or replace function public.current_resident_unit_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select o.unit_id from public.occupancies o
   where o.owner_id = public.current_owner_id()
     and o.status = 'current'
     and (o.move_out_date is null or o.move_out_date > current_date);
$function$;

create or replace function public.current_resident_association_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select distinct b.association_id
    from public.occupancies o
    join public.units un on un.id = o.unit_id
    join public.buildings b on b.id = un.building_id
   where o.owner_id = public.current_owner_id()
     and o.status = 'current'
     and (o.move_out_date is null or o.move_out_date > current_date);
$function$;

create or replace function public.current_resident_unit_since(p_unit uuid)
returns date
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select case when bool_or(o.move_in_date is null) then null else min(o.move_in_date) end
    from public.occupancies o
   where o.owner_id = public.current_owner_id()
     and o.status = 'current'
     and (o.move_out_date is null or o.move_out_date > current_date)
     and o.unit_id = p_unit;
$function$;

-- 2. Read-only board: a board member could still edit or delete comments they
--    wrote before the lockdown. Staff and operators keep their own policies
--    (staff_board_comments, operator_all_board_comments).
alter policy board_update_own_comments on public.board_comments using (false);
alter policy board_delete_own_comments on public.board_comments using (false);
