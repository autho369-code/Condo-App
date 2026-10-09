-- A homeowner record belongs to exactly ONE association.
--
-- Decision (Mirsad, final): an owners row is a homeowner of one association
-- (property), never of the company at large. One record may own any number of
-- units in any building of that association. The same person owning in a
-- second association gets a separate owners row there.
--
-- 1. owners.association_id (not null, FK -> associations, ON DELETE RESTRICT:
--    a plain association delete never removes homeowners silently; use
--    delete_association_completely()), backfilled from the owner's
--    occupancies. The migration refuses to finish while any owner has no
--    association, units in more than one, or an association without a company.
-- 2. owners.portfolio_id stays (every owners RLS policy uses it) but is now
--    derived: a BEFORE trigger copies it from the association, and an
--    association moving company takes its homeowners along. RLS WITH CHECK
--    runs after BEFORE triggers, so an insert naming another company's
--    association fails the portfolio policy. Moving a record to another
--    association is refused while it still has occupancies in the old one.
-- 3. BEFORE triggers on occupancies and unit_owners refuse to link an owner to
--    a unit of another association, and an occupancy's association must be
--    its unit's. This covers every writer centrally: change_unit_homeowner,
--    transfer_unit_ownership, linkOccupancy, owner create, CSV import, the
--    previous-system import and direct table writes. A unit or building with
--    homeowner/resident links cannot move to another association.
-- 4. Portal sign-in: owners(auth_user_id) stays unique (one sign-in, one
--    record). auto_link_portal_user() and relink_all_portal_users() now link
--    the oldest matching record instead of failing on a second one.
--
-- Phase 2 (not here): current_owner_id() still returns ONE record (the oldest
-- active one), so the owner portal shows a single association for a person
-- with records in two. A multi-property portal (association switcher, or
-- current_owner_ids()) is the follow-up.
--
-- Additive: nothing is dropped.

-- 1) Column + index ----------------------------------------------------------

alter table public.owners
  add column if not exists association_id uuid references public.associations(id) on delete restrict;

create index if not exists idx_owners_association_id on public.owners(association_id);

comment on column public.owners.association_id is
  'The one association (property) this homeowner record belongs to. The same person in another association has a separate record. portfolio_id is derived from it (trg_owners_set_portfolio_from_association).';

-- 2) Backfill, then require it -----------------------------------------------

do $$
declare
  v_missing integer;
begin
  -- First from current owner occupancies: owners whose current units are all
  -- in one association.
  with one_assoc as (
    select o.owner_id, min(o.association_id::text)::uuid as association_id
    from public.occupancies o
    where o.owner_id is not null
      and o.occupancy_type = 'owner'
      and o.status = 'current'
    group by o.owner_id
    having count(distinct o.association_id) = 1
  )
  update public.owners ow
     set association_id = one_assoc.association_id
    from one_assoc
   where ow.id = one_assoc.owner_id
     and ow.association_id is null;

  -- Then former owners (only past occupancies): still one association only.
  with one_assoc as (
    select o.owner_id, min(o.association_id::text)::uuid as association_id
    from public.occupancies o
    where o.owner_id is not null
    group by o.owner_id
    having count(distinct o.association_id) = 1
  )
  update public.owners ow
     set association_id = one_assoc.association_id
    from one_assoc
   where ow.id = one_assoc.owner_id
     and ow.association_id is null;

  select count(*) into v_missing from public.owners where association_id is null;
  if v_missing > 0 then
    raise exception '% homeowner record(s) have no property or units in more than one association. A homeowner now belongs to exactly one association: delete those records, or split each into one record per association, then run this migration again.', v_missing
      using errcode = '23502';
  end if;

  -- Every existing link must already respect the rule (no occupancy of an
  -- owner in another association, no association without a company).
  select count(*) into v_missing
    from public.occupancies o join public.owners ow on ow.id = o.owner_id
   where o.association_id is distinct from ow.association_id;
  if v_missing > 0 then
    raise exception '% unit link(s) connect a homeowner to another association. Split those homeowners into one record per association, then run this migration again.', v_missing
      using errcode = '23514';
  end if;
  select count(*) into v_missing
    from public.unit_owners uo
    join public.owners ow on ow.id = uo.owner_id
    join public.units u on u.id = uo.unit_id
    join public.buildings b on b.id = u.building_id
   where b.association_id is distinct from ow.association_id;
  if v_missing > 0 then
    raise exception '% unit ownership row(s) connect a homeowner to a unit of another association. Split those homeowners into one record per association, then run this migration again.', v_missing
      using errcode = '23514';
  end if;
  select count(*) into v_missing
    from public.occupancies o
    join public.units u on u.id = o.unit_id
    join public.buildings b on b.id = u.building_id
   where o.association_id is distinct from b.association_id;
  if v_missing > 0 then
    raise exception '% unit link(s) record a different association than their unit''s. Correct them, then run this migration again.', v_missing
      using errcode = '23514';
  end if;
  select count(*) into v_missing
    from public.owners ow join public.associations a on a.id = ow.association_id
   where a.portfolio_id is null;
  if v_missing > 0 then
    raise exception '% homeowner record(s) belong to an association that has no company. Give the association its company first.', v_missing
      using errcode = '23502';
  end if;

  alter table public.owners alter column association_id set not null;
end $$;

-- Existing rows: portfolio_id from their association (no-op on consistent data).
update public.owners ow
   set portfolio_id = a.portfolio_id
  from public.associations a
 where a.id = ow.association_id
   and ow.portfolio_id is distinct from a.portfolio_id;

-- 3) owners.portfolio_id follows the association -----------------------------

create or replace function public.owners_set_portfolio_from_association()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_portfolio_id uuid;
begin
  if new.association_id is null then
    raise exception 'A homeowner must belong to an association.' using errcode = '23502';
  end if;

  select a.portfolio_id into v_portfolio_id
  from public.associations a
  where a.id = new.association_id;

  if not found then
    raise exception 'Association not found for this homeowner.' using errcode = '23503';
  end if;
  if v_portfolio_id is null then
    raise exception 'This association has no company, so it cannot have homeowners yet.' using errcode = '23502';
  end if;

  if tg_op = 'UPDATE' and new.association_id is distinct from old.association_id and exists (
    select 1 from public.occupancies o
    where o.owner_id = new.id and o.association_id <> new.association_id
  ) or exists (
    select 1 from public.unit_owners uo
      join public.units u on u.id = uo.unit_id
      join public.buildings bl on bl.id = u.building_id
     where uo.owner_id = new.id and bl.association_id <> new.association_id
  ) then
    raise exception 'This homeowner has units in their current association. Add them as a new homeowner of the other association instead.'
      using errcode = '23514';
  end if;

  new.portfolio_id := v_portfolio_id;
  return new;
end;
$function$;

revoke all on function public.owners_set_portfolio_from_association() from public, anon, authenticated;

create or replace trigger trg_owners_set_portfolio_from_association
  before insert or update of association_id, portfolio_id on public.owners
  for each row execute function public.owners_set_portfolio_from_association();

-- 4) Occupancies only link an owner of the same association -------------------

create or replace function public.occupancies_owner_same_association()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_unit_association_id uuid;
  v_owner_association_id uuid;
begin
  -- The association a link records must be the unit's own (it is what the
  -- access rules read), whoever writes it.
  if new.unit_id is not null then
    select b.association_id into v_unit_association_id
      from public.units u join public.buildings b on b.id = u.building_id
     where u.id = new.unit_id;
    if found and new.association_id is distinct from v_unit_association_id then
      raise exception 'This unit belongs to another association.' using errcode = '23514';
    end if;
  end if;

  if new.owner_id is null then
    return new;
  end if;

  select ow.association_id into v_owner_association_id
    from public.owners ow
   where ow.id = new.owner_id
   for share;

  -- A missing owner is left to the owner_id foreign key.
  if found and v_owner_association_id is distinct from new.association_id then
    raise exception 'This homeowner belongs to another association. Add them as a new homeowner of this association.'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.occupancies_owner_same_association() from public, anon, authenticated;

create or replace trigger trg_occupancies_owner_same_association
  before insert or update of owner_id, association_id, unit_id on public.occupancies
  for each row execute function public.occupancies_owner_same_association();

-- unit_owners rows (written by the occupancy sync and by transfer_unit_ownership)
-- follow the same rule: the owner and the unit share an association.
create or replace function public.unit_owners_same_association()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_unit_association_id uuid;
  v_owner_association_id uuid;
begin
  select b.association_id into v_unit_association_id
    from public.units u join public.buildings b on b.id = u.building_id
   where u.id = new.unit_id;
  select ow.association_id into v_owner_association_id
    from public.owners ow where ow.id = new.owner_id for share;
  if v_unit_association_id is not null and v_owner_association_id is not null
     and v_unit_association_id <> v_owner_association_id then
    raise exception 'This homeowner belongs to another association. Add them as a new homeowner of this association.'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke all on function public.unit_owners_same_association() from public, anon, authenticated;

create or replace trigger trg_unit_owners_same_association
  before insert or update of owner_id, unit_id on public.unit_owners
  for each row execute function public.unit_owners_same_association();

-- A unit or building may not move to another association while it has
-- homeowner or tenant links: they would keep pointing at the old association's
-- homeowners. Move the people out first (or delete and re-add the unit).
create or replace function public.units_move_keeps_association()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_old uuid;
  v_new uuid;
begin
  select b.association_id into v_old from public.buildings b where b.id = old.building_id;
  select b.association_id into v_new from public.buildings b where b.id = new.building_id;
  if v_old is distinct from v_new and (
       exists (select 1 from public.occupancies o where o.unit_id = new.id)
       or exists (select 1 from public.unit_owners uo where uo.unit_id = new.id)) then
    raise exception 'This unit has homeowners or residents, so it cannot move to another association.'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke all on function public.units_move_keeps_association() from public, anon, authenticated;

create or replace trigger trg_units_move_keeps_association
  before update of building_id on public.units
  for each row when (new.building_id is distinct from old.building_id)
  execute function public.units_move_keeps_association();

create or replace function public.buildings_move_keeps_association()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if exists (select 1 from public.units u join public.occupancies o on o.unit_id = u.id where u.building_id = new.id)
     or exists (select 1 from public.units u join public.unit_owners uo on uo.unit_id = u.id where u.building_id = new.id) then
    raise exception 'This building has units with homeowners or residents, so it cannot move to another association.'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke all on function public.buildings_move_keeps_association() from public, anon, authenticated;

create or replace trigger trg_buildings_move_keeps_association
  before update of association_id on public.buildings
  for each row when (new.association_id is distinct from old.association_id)
  execute function public.buildings_move_keeps_association();

-- An association that moves to another company takes its homeowners with it.
create or replace function public.associations_move_owner_portfolio()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  update public.owners set portfolio_id = new.portfolio_id
   where association_id = new.id and portfolio_id is distinct from new.portfolio_id;
  return new;
end;
$function$;

revoke all on function public.associations_move_owner_portfolio() from public, anon, authenticated;

create or replace trigger trg_associations_move_owner_portfolio
  after update of portfolio_id on public.associations
  for each row when (new.portfolio_id is distinct from old.portfolio_id)
  execute function public.associations_move_owner_portfolio();

-- 5) Portal sign-in -----------------------------------------------------------
-- owners.auth_user_id stays unique: one sign-in, one homeowner record (so a
-- shared family email can never open another person's records). With one
-- record per association the same email can be on several records, so the
-- auto-link now links the oldest one instead of failing the sign-up on the
-- second. A person with records in two associations sees one of them in the
-- portal until the multi-property portal (Phase 2).

create or replace function public.auto_link_portal_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_portfolio_id uuid;
begin
  select p.portfolio_id into v_portfolio_id
  from public.profiles p
  where p.id = new.id and p.disabled_at is null;

  if v_portfolio_id is null then
    return new;
  end if;

  -- One homeowner record per sign-in (owners.auth_user_id is unique). With one
  -- record per association, the same email can now be on several records:
  -- link the oldest instead of failing the whole sign-up on the second.
  update public.owners o
     set auth_user_id = new.id, portal_activated = true
   where o.id = (
     select candidate.id
       from public.owners candidate
      where candidate.portfolio_id = v_portfolio_id
        and candidate.auth_user_id is null
        and candidate.archived_at is null
        and lower(candidate.email) = lower(new.email)
      order by candidate.created_at, candidate.id
      limit 1
   )
     and not exists (select 1 from public.owners linked where linked.auth_user_id = new.id)
     and exists (
       select 1 from public.profiles p
       where p.id = new.id and p.hoa_role in ('owner', 'board') and p.disabled_at is null
     );

  update public.vendors v
     set auth_user_id = new.id, portal_activated = true
   where v.portfolio_id = v_portfolio_id
     and v.auth_user_id is null
     and v.archived_at is null
     and exists (
       select 1 from public.profiles p
       where p.id = new.id and p.hoa_role = 'vendor' and p.disabled_at is null
     )
     and exists (
       select 1 from jsonb_array_elements_text(v.emails) as e(email)
       where lower(e.email) = lower(new.email)
     );

  update public.board_members bm
     set auth_user_id = new.id
   where bm.auth_user_id is null
     and bm.active
     and lower(bm.email) = lower(new.email)
     and exists (
       select 1 from public.profiles p
       where p.id = new.id and p.hoa_role = 'board' and p.disabled_at is null
     )
     and exists (
       select 1 from public.associations a
       where a.id = bm.association_id and a.portfolio_id = v_portfolio_id
     );

  update public.tenants t
     set auth_user_id = new.id,
         portal_activated = true,
         updated_at = now()
   where t.id = (
     select candidate.id
     from public.tenants candidate
     where candidate.portfolio_id = v_portfolio_id
       and candidate.auth_user_id is null
       and candidate.status = 'active'
       and candidate.archived_at is null
       and lower(candidate.email) = lower(new.email)
       and exists (
         select 1 from public.profiles p
         where p.id = new.id and p.hoa_role = 'tenant' and p.disabled_at is null
       )
     order by candidate.created_at desc, candidate.id
     limit 1
   );

  update public.profiles p
     set hoa_role = 'board'
   where p.id = new.id
     and p.hoa_role = 'owner'
     and exists (
       select 1 from public.board_members bm
       where bm.auth_user_id = new.id and bm.active
     );

  return new;
end;
$function$;

create or replace function public.relink_all_portal_users()
returns table(target_table text, rows_linked integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  n_owners integer;
  n_board integer;
  n_vendors integer;
  n_tenants integer;
begin
  -- At most one homeowner record per sign-in: the oldest unlinked match, and
  -- only for sign-ins not linked to a homeowner record yet.
  with pick as (
    select distinct on (u.id) u.id as user_id, o.id as owner_id
      from auth.users u
      join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role in ('owner', 'board')
      join public.owners o on o.portfolio_id = p.portfolio_id and lower(o.email) = lower(u.email)
     where o.auth_user_id is null
       and o.archived_at is null
       and not exists (select 1 from public.owners linked where linked.auth_user_id = u.id)
     order by u.id, o.created_at, o.id
  ), upd as (
    update public.owners o
       set auth_user_id = pick.user_id
      from pick
     where o.id = pick.owner_id
    returning 1
  ) select count(*) into n_owners from upd;

  with upd as (
    update public.board_members bm
       set auth_user_id = u.id
      from auth.users u
      join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role = 'board'
     where bm.auth_user_id is null
       and bm.active
       and lower(u.email) = lower(bm.email)
       and exists (
         select 1 from public.associations a
         where a.id = bm.association_id and a.portfolio_id = p.portfolio_id
       )
    returning 1
  ) select count(*) into n_board from upd;

  with upd as (
    update public.vendors v
       set auth_user_id = u.id
      from auth.users u
      join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role = 'vendor'
     where v.auth_user_id is null
       and v.archived_at is null
       and v.portfolio_id = p.portfolio_id
       and exists (
         select 1 from jsonb_array_elements_text(v.emails) as e(email)
         where lower(e.email) = lower(u.email)
       )
    returning 1
  ) select count(*) into n_vendors from upd;

  with candidates as (
    select distinct on (u.id) t.id as tenant_id, u.id as auth_user_id
    from auth.users u
    join public.profiles p
      on p.id = u.id
     and p.disabled_at is null
     and p.hoa_role = 'tenant'
    join public.tenants t
      on t.portfolio_id = p.portfolio_id
     and t.auth_user_id is null
     and t.status = 'active'
     and t.archived_at is null
     and lower(u.email) = lower(t.email)
    order by u.id, t.created_at desc, t.id
  ), upd as (
    update public.tenants t
       set auth_user_id = candidates.auth_user_id,
           portal_activated = true,
           updated_at = now()
      from candidates
     where t.id = candidates.tenant_id
    returning 1
  ) select count(*) into n_tenants from upd;

  return query values
    ('owners', n_owners),
    ('board_members', n_board),
    ('vendors', n_vendors),
    ('tenants', n_tenants);
end;
$function$;
