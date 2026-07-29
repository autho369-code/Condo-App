-- See supabase/migrations/20260705000004_company_admin_finance_and_unit_count.sql

create or replace function public.is_finance_staff()
  returns boolean
  language sql
  stable security definer
  set search_path to 'pg_catalog', 'public'
as $function$
  select exists(
    select 1
    from public.profiles p
    left join public.user_roles ur on ur.id = p.role_id
    where p.id = auth.uid()
      and (
        p.hoa_role = 'company_admin'
        or (
          p.hoa_role = 'manager'
          and (ur.name in ('President', 'Property Manager', 'Accountant') or ur.name is null)
        )
      )
  );
$function$;

update public.associations a
set unit_count = sub.cnt
from (
  select b.association_id, count(u.id) as cnt
  from public.units u
  join public.buildings b on b.id = u.building_id
  group by b.association_id
) sub
where sub.association_id = a.id
  and coalesce(a.unit_count, 0) <> sub.cnt;

create or replace function public.sync_association_unit_count()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'pg_catalog', 'public'
as $function$
declare
  affected uuid[];
begin
  select array_agg(distinct b.association_id) into affected
  from public.buildings b
  where b.id in (coalesce(new.building_id, old.building_id), coalesce(old.building_id, new.building_id));

  update public.associations a
  set unit_count = (
    select count(*) from public.units u
    join public.buildings b on b.id = u.building_id
    where b.association_id = a.id
  )
  where a.id = any(affected);

  return coalesce(new, old);
end;
$function$;

drop trigger if exists trg_sync_association_unit_count on public.units;
create trigger trg_sync_association_unit_count
  after insert or delete or update of building_id on public.units
  for each row execute function public.sync_association_unit_count();;
