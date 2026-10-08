-- Import locks: one running import per association (or, for company-wide
-- imports such as vendors, per company) and kind.
--
-- Two managers (or one double-click) could start the same AppFolio import for
-- the same association at once; both runs read "not imported yet" and both
-- wrote, which doubled owners, charges and bills. lib/imports/import-lock.ts
-- claims a row here before an import starts and deletes it in a finally.
--
-- A lock older than 15 minutes is treated as abandoned (a crashed or timed-out
-- server action never reached its finally) and is taken over on the next
-- claim. claim_import_lock does that with a DELETE inside its function body,
-- scoped to the one stale row of the caller's own scope; the migration
-- itself runs no DROP or DELETE.
--
-- scope_id is an association id (association imports) or a company
-- (portfolio) id (company-wide imports). Access: staff who can manage the
-- association (can_manage_association), or staff of the company
-- (is_any_staff + can_access_portfolio, the vendors policy). Board, owner and
-- vendor users cannot. No foreign key, because the scope is either table; a
-- leftover row is harmless (it goes stale after 15 minutes).

create table if not exists public.import_locks (
  scope_id uuid not null,
  kind text not null check (length(kind) between 1 and 60),
  claimed_by uuid not null default auth.uid(),
  claimed_at timestamptz not null default now(),
  primary key (scope_id, kind)
);

alter table public.import_locks enable row level security;

-- Who may hold a lock on this scope (plpgsql per the RLS helper rule).
create or replace function public.can_hold_import_lock(p_scope_id uuid)
returns boolean
language plpgsql
stable
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
begin
  return public.can_manage_association(p_scope_id)
      or (public.is_any_staff() and public.can_access_portfolio(p_scope_id));
end $function$;

revoke all on function public.can_hold_import_lock(uuid) from public, anon;
grant execute on function public.can_hold_import_lock(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'import_locks' and policyname = 'import_locks_staff_read') then
    create policy import_locks_staff_read on public.import_locks
      for select to authenticated using (public.can_hold_import_lock(scope_id));
  end if;
  -- A lock can't be dated in the future (it would never go stale).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'import_locks' and policyname = 'import_locks_staff_claim') then
    create policy import_locks_staff_claim on public.import_locks
      for insert to authenticated
      with check (public.can_hold_import_lock(scope_id) and claimed_by = auth.uid() and claimed_at <= now());
  end if;
  -- Only the holder releases a live lock; anyone who manages the association can clear a stale one.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'import_locks' and policyname = 'import_locks_staff_release') then
    create policy import_locks_staff_release on public.import_locks
      for delete to authenticated
      using (public.can_hold_import_lock(scope_id)
             and (claimed_by = auth.uid() or claimed_at < now() - interval '15 minutes'));
  end if;
end $$;

revoke all on public.import_locks from anon;
revoke update on public.import_locks from authenticated;
grant select, insert, delete on public.import_locks to authenticated;

-- Claim the lock: returns the claim time (the release token), or null when another import holds it.
-- SECURITY INVOKER: every statement runs under the caller's RLS above.
create or replace function public.claim_import_lock(p_scope_id uuid, p_kind text)
returns timestamptz
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_claimed_at timestamptz;
begin
  if not public.can_hold_import_lock(p_scope_id) then
    raise exception 'Association or company not found' using errcode = '42501';
  end if;
  if p_kind is null or length(p_kind) not between 1 and 60 then
    raise exception 'Invalid import kind' using errcode = '22023';
  end if;
  -- Take over an abandoned lock (see header).
  delete from public.import_locks
   where scope_id = p_scope_id and kind = p_kind
     and claimed_at < now() - interval '15 minutes';
  insert into public.import_locks (scope_id, kind, claimed_by, claimed_at)
  values (p_scope_id, p_kind, auth.uid(), now())
  on conflict (scope_id, kind) do nothing
  returning claimed_at into v_claimed_at;
  return v_claimed_at;
end $function$;

revoke all on function public.claim_import_lock(uuid, text) from public, anon;
grant execute on function public.claim_import_lock(uuid, text) to authenticated;
