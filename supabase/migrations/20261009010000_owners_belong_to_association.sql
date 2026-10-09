-- A homeowner record belongs to exactly ONE association.
--
-- Decision (Mirsad, final): an owners row is a homeowner of one association
-- (property), never of the company at large. One record may own any number of
-- units in any building of that association. The same person owning in a
-- second association gets a separate owners row there.
--
-- 1. owners.association_id (not null, FK -> associations, cascade), backfilled
--    from the owner's occupancies. The migration refuses to finish while any
--    owner has no association or more than one; those rows must be cleaned up
--    first (production had 14 orphan demo owners, deleted before this runs).
-- 2. owners.portfolio_id stays (every owners RLS policy uses it) but is now
--    derived: a BEFORE trigger copies it from the association, so the two can
--    never disagree. RLS WITH CHECK runs after BEFORE triggers, so an insert
--    naming another company's association fails the portfolio policy.
--    Moving a record to another association is refused while it still has
--    occupancies in the old one.
-- 3. A BEFORE trigger on occupancies refuses to link an owner to a unit of
--    another association. This covers every writer centrally:
--    change_unit_homeowner, transfer_unit_ownership, linkOccupancy, owner
--    create, CSV import and the previous-system import.
-- 4. Portal sign-in for a person with records in two associations: the UNIQUE
--    index on owners(auth_user_id) is replaced by a plain one, so one sign-in
--    can link to each of their records. auto_link_portal_user(),
--    relink_portal_user_on_email_change() and relink_all_portal_users()
--    (20260803050000_resident_portal_access.sql) already update EVERY matching
--    owners row (same company, same email); with the unique index gone they
--    link all of a person's records instead of failing on the second one, so
--    they are left unchanged. No ON CONFLICT (auth_user_id) depends on it.
--
-- Phase 2 (not here): current_owner_id() still returns ONE record (the oldest
-- active one), so the owner portal shows a single association for a person
-- with records in two. A multi-property portal (association switcher, or
-- current_owner_ids()) is the follow-up.
--
-- Additive: no table is dropped; the only DROP is the unique index above.

-- 1) Column + index ----------------------------------------------------------

alter table public.owners
  add column if not exists association_id uuid references public.associations(id) on delete cascade;

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

  if v_portfolio_id is null then
    raise exception 'Association not found for this homeowner.' using errcode = '23503';
  end if;

  if tg_op = 'UPDATE' and new.association_id is distinct from old.association_id and exists (
    select 1 from public.occupancies o
    where o.owner_id = new.id and o.association_id <> new.association_id
  ) then
    raise exception 'This homeowner has units in their current association. Add them as a new homeowner of the other association instead.'
      using errcode = '23514';
  end if;

  new.portfolio_id := v_portfolio_id;
  return new;
end;
$function$;

revoke all on function public.owners_set_portfolio_from_association() from public, anon, authenticated;

drop trigger if exists trg_owners_set_portfolio_from_association on public.owners;
create trigger trg_owners_set_portfolio_from_association
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
  v_owner_association_id uuid;
begin
  if new.owner_id is null then
    return new;
  end if;

  select ow.association_id into v_owner_association_id
  from public.owners ow
  where ow.id = new.owner_id;

  -- A missing owner is left to the owner_id foreign key.
  if found and v_owner_association_id is distinct from new.association_id then
    raise exception 'This homeowner belongs to another association. Add them as a new homeowner of this association.'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.occupancies_owner_same_association() from public, anon, authenticated;

drop trigger if exists trg_occupancies_owner_same_association on public.occupancies;
create trigger trg_occupancies_owner_same_association
  before insert or update of owner_id, association_id on public.occupancies
  for each row execute function public.occupancies_owner_same_association();

-- 5) One sign-in may link to several homeowner records -----------------------

drop index if exists public.idx_owners_auth_user;
create index if not exists idx_owners_auth_user
  on public.owners(auth_user_id)
  where auth_user_id is not null;
