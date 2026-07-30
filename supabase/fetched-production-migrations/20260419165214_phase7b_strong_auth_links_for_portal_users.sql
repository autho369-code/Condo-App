-- =============================================================================
-- Phase 7b — Strong auth links for portal users
-- Replaces fragile email-matching with proper auth_user_id foreign keys.
-- Email matching kept as a fallback for backward compat.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add auth_user_id columns
-- -----------------------------------------------------------------------------
alter table public.owners
  add column auth_user_id uuid references auth.users(id) on delete set null;
create unique index idx_owners_auth_user on public.owners(auth_user_id) where auth_user_id is not null;

alter table public.board_members
  add column auth_user_id uuid references auth.users(id) on delete set null;
create index idx_board_members_auth_user on public.board_members(auth_user_id) where auth_user_id is not null;

alter table public.vendors
  add column auth_user_id uuid references auth.users(id) on delete set null;
create unique index idx_vendors_auth_user on public.vendors(auth_user_id) where auth_user_id is not null;

-- -----------------------------------------------------------------------------
-- 2. Backfill from existing email matches (safe: touches rows where auth user
--    with the same email already exists). Zero rows currently, but sets pattern.
-- -----------------------------------------------------------------------------
update public.owners o
   set auth_user_id = u.id
  from auth.users u
 where lower(u.email) = lower(o.email)
   and o.auth_user_id is null
   and o.archived_at is null;

update public.board_members bm
   set auth_user_id = u.id
  from auth.users u
 where lower(u.email) = lower(bm.email)
   and bm.auth_user_id is null
   and bm.active;

update public.vendors v
   set auth_user_id = u.id
  from auth.users u
 where v.auth_user_id is null
   and v.archived_at is null
   and exists (
     select 1
       from jsonb_array_elements_text(v.emails) as e(email)
      where lower(e.email) = lower(u.email)
   );

-- -----------------------------------------------------------------------------
-- 3. Auto-link on new auth user creation
--    When a new auth user signs up, look for owners/board_members/vendors
--    matching their email and populate auth_user_id.
-- -----------------------------------------------------------------------------
create or replace function public.auto_link_portal_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- Owners: one user can only own one owner record (unique constraint)
  update public.owners
     set auth_user_id = new.id
   where auth_user_id is null
     and archived_at is null
     and lower(email) = lower(new.email);

  -- Vendors: one user = one vendor record (unique constraint)
  update public.vendors v
     set auth_user_id = new.id
   where v.auth_user_id is null
     and v.archived_at is null
     and exists (
       select 1 from jsonb_array_elements_text(v.emails) as e(email)
       where lower(e.email) = lower(new.email)
     );

  -- Board members: one user can serve on multiple boards
  update public.board_members
     set auth_user_id = new.id
   where auth_user_id is null
     and active
     and lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists trg_auto_link_portal_user on auth.users;
create trigger trg_auto_link_portal_user
  after insert on auth.users
  for each row execute function public.auto_link_portal_user();

-- Also fire on email update so re-linking works if someone changes their email
create or replace function public.relink_portal_user_on_email_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.email is distinct from old.email then
    -- Clear stale links where the email no longer matches
    update public.owners set auth_user_id = null
      where auth_user_id = new.id and lower(email) <> lower(new.email);
    update public.board_members set auth_user_id = null
      where auth_user_id = new.id and lower(email) <> lower(new.email);
    update public.vendors v set auth_user_id = null
      where v.auth_user_id = new.id
        and not exists (
          select 1 from jsonb_array_elements_text(v.emails) as e(email)
          where lower(e.email) = lower(new.email)
        );
    -- Then re-run the linker for the new email
    perform public.auto_link_portal_user() from (select new.*) s;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_relink_portal_user_on_email on auth.users;
create trigger trg_relink_portal_user_on_email
  after update of email on auth.users
  for each row execute function public.relink_portal_user_on_email_change();

-- -----------------------------------------------------------------------------
-- 4. Rewrite helpers to prefer auth_user_id, fall back to email match
-- -----------------------------------------------------------------------------

create or replace function public.current_owner_id()
returns uuid
language sql stable security definer set search_path = pg_catalog, public
as $$
  select coalesce(
    -- Strong link
    (select o.id from public.owners o
      where o.auth_user_id = auth.uid() and o.archived_at is null
      limit 1),
    -- Fallback: email match (for rows not yet auto-linked)
    (select o.id from public.owners o
      join auth.users u on lower(u.email) = lower(o.email)
      where u.id = auth.uid() and o.archived_at is null
      limit 1)
  );
$$;

create or replace function public.current_board_association_ids()
returns setof uuid
language sql stable security definer set search_path = pg_catalog, public
as $$
  select association_id from public.board_members
   where auth_user_id = auth.uid() and active
  union
  select bm.association_id from public.board_members bm
   join auth.users u on lower(u.email) = lower(bm.email)
   where u.id = auth.uid() and bm.active and bm.auth_user_id is null;
$$;

create or replace function public.current_vendor_id()
returns uuid
language sql stable security definer set search_path = pg_catalog, public
as $$
  select coalesce(
    -- Strong link
    (select v.id from public.vendors v
      where v.auth_user_id = auth.uid()
        and v.archived_at is null
        and v.portal_activated
      limit 1),
    -- Fallback: jsonb email scan (expensive, but covers pre-linked rows)
    (select v.id from public.vendors v
      where v.archived_at is null
        and v.portal_activated
        and v.auth_user_id is null
        and exists (
          select 1
            from auth.users u
            cross join lateral jsonb_array_elements_text(v.emails) as e(email)
           where u.id = auth.uid()
             and lower(e.email) = lower(u.email)
        )
      limit 1)
  );
$$;

-- current_resident_unit_ids and current_resident_association_ids already use
-- current_owner_id(), so they automatically pick up the stronger link.

-- -----------------------------------------------------------------------------
-- 5. One-shot manual link function (useful for ops / data repair)
-- -----------------------------------------------------------------------------
create or replace function public.relink_all_portal_users()
returns table(target_table text, rows_linked integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  n_owners integer;
  n_board integer;
  n_vendors integer;
begin
  with upd as (
    update public.owners o
       set auth_user_id = u.id
      from auth.users u
     where o.auth_user_id is null
       and o.archived_at is null
       and lower(u.email) = lower(o.email)
    returning 1
  ) select count(*) into n_owners from upd;

  with upd as (
    update public.board_members bm
       set auth_user_id = u.id
      from auth.users u
     where bm.auth_user_id is null
       and bm.active
       and lower(u.email) = lower(bm.email)
    returning 1
  ) select count(*) into n_board from upd;

  with upd as (
    update public.vendors v
       set auth_user_id = u.id
      from auth.users u
     where v.auth_user_id is null
       and v.archived_at is null
       and exists (
         select 1 from jsonb_array_elements_text(v.emails) as e(email)
         where lower(e.email) = lower(u.email)
       )
    returning 1
  ) select count(*) into n_vendors from upd;

  return query values
    ('owners', n_owners),
    ('board_members', n_board),
    ('vendors', n_vendors);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Comments
-- -----------------------------------------------------------------------------
comment on column public.owners.auth_user_id is 'Strong link to auth.users. Auto-populated on signup by trg_auto_link_portal_user; email match is the fallback.';
comment on column public.vendors.auth_user_id is 'Strong link for the vendor portal user. Vendors can have multiple team emails in vendors.emails, but only one primary portal auth user.';
comment on column public.board_members.auth_user_id is 'Strong link. A single user can be linked to multiple board_members rows (one per association they serve on).';
comment on function public.auto_link_portal_user() is 'Fires on auth.users INSERT. Populates auth_user_id on any matching owner/board_member/vendor by email.';
comment on function public.relink_all_portal_users() is 'One-shot backfill. Run after bulk importing owners/vendors/board_members to link them to existing auth users. Returns counts per table.';
;
