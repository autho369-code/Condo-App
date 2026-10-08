-- associations.property_group_id's foreign key accepts any company's group,
-- and associations_staff_all lets staff write the column directly. A staff
-- user who knew another company's group id could attach their association to
-- it, and that company's property group directory report
-- (report_data_property_group_directory, SECURITY DEFINER) would count the
-- foreign association and its units. The app now checks the group's company
-- (associations/new, createBuilding, setPropertyGroupMembers); this makes the
-- database refuse it too, and the report counts only the company's own
-- associations.
-- Production had no mismatched rows when this was written (0 of 0 grouped).
-- Additive only: no DROP, no DELETE.

create or replace function public.enforce_association_property_group_company()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  -- FOR SHARE locks the group row: a concurrent move of the group (an UPDATE,
  -- which conflicts) waits for this transaction, then its own check sees this
  -- association; and if the move got there first, this waits and re-reads the
  -- moved row, which no longer matches. The two checks can't both pass.
  if new.property_group_id is not null and not exists (
    select 1 from public.property_groups pg
     where pg.id = new.property_group_id
       and pg.portfolio_id = new.portfolio_id
       for share
  ) then
    raise exception 'Property group not found for this company' using errcode = '23503';
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_association_property_group_company() from public, anon, authenticated;

do $mig$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'associations_property_group_same_company'
       and tgrelid = 'public.associations'::regclass
  ) then
    create trigger associations_property_group_same_company
      before insert or update of property_group_id, portfolio_id on public.associations
      for each row execute function public.enforce_association_property_group_company();
  end if;
end
$mig$;

-- The same rule from the group's side: a group with associations can't be
-- moved to another company (they would point at another company's group).
create or replace function public.enforce_property_group_company_move()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.portfolio_id is distinct from old.portfolio_id and exists (
    select 1 from public.associations a where a.property_group_id = old.id
  ) then
    raise exception 'Remove the associations from this group before moving it to another company' using errcode = '23503';
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_property_group_company_move() from public, anon, authenticated;

do $mig$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'property_groups_company_move'
       and tgrelid = 'public.property_groups'::regclass
  ) then
    create trigger property_groups_company_move
      before update of portfolio_id on public.property_groups
      for each row execute function public.enforce_property_group_company_move();
  end if;
end
$mig$;

-- Same body as 20260928000200, plus the association's company in the join.
create or replace function public.report_data_property_group_directory(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select pg.name, pg.description, count(a.id) as associations, coalesce(sum(a.unit_count),0) as units
      from public.property_groups pg left join public.associations a
        on a.property_group_id = pg.id and a.archived_at is null and a.portfolio_id = pg.portfolio_id
      where pg.portfolio_id = p_portfolio_id group by pg.id order by pg.name
  ) r;
$function$;

revoke all on function public.report_data_property_group_directory(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_property_group_directory(p_portfolio_id uuid, p_params jsonb) to service_role;
