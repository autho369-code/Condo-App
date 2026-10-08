-- Import locks: one running import per association and kind.
--
-- Two managers (or one double-click) could start the same AppFolio import for
-- the same association at once; both runs read "not imported yet" and both
-- wrote, which doubled owners, charges and bills. lib/imports/import-lock.ts
-- claims a row here before an import starts and deletes it in a finally.
--
-- A lock older than 15 minutes is treated as abandoned (a crashed or timed-out
-- server action never reached its finally) and is taken over on the next
-- claim. claim_import_lock does that with a DELETE inside its function body,
-- scoped to the one stale row of the caller's own association; the migration
-- itself runs no DROP or DELETE.
--
-- Access follows the association-record pattern: staff who can manage the
-- association (can_manage_association = staff/company admin/operator +
-- can_access_association + can_view_association_row) can read, claim and
-- release that association's locks. Board, owner and vendor users cannot.

create table if not exists public.import_locks (
  association_id uuid not null references public.associations(id) on delete cascade,
  kind text not null check (length(kind) between 1 and 60),
  claimed_by uuid not null default auth.uid(),
  claimed_at timestamptz not null default now(),
  primary key (association_id, kind)
);

alter table public.import_locks enable row level security;

create policy import_locks_staff_read on public.import_locks
  for select to authenticated using (public.can_manage_association(association_id));
create policy import_locks_staff_claim on public.import_locks
  for insert to authenticated
  with check (public.can_manage_association(association_id) and claimed_by = auth.uid());
create policy import_locks_staff_release on public.import_locks
  for delete to authenticated using (public.can_manage_association(association_id));

grant select, insert, delete on public.import_locks to authenticated;

-- Claim the lock; true when claimed, false when another import holds it.
-- SECURITY INVOKER: every statement runs under the caller's RLS above.
create or replace function public.claim_import_lock(p_association_id uuid, p_kind text)
returns boolean
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if not public.can_manage_association(p_association_id) then
    raise exception 'Association not found' using errcode = '42501';
  end if;
  if p_kind is null or length(p_kind) not between 1 and 60 then
    raise exception 'Invalid import kind' using errcode = '22023';
  end if;
  -- Take over an abandoned lock (see header).
  delete from public.import_locks
   where association_id = p_association_id and kind = p_kind
     and claimed_at < now() - interval '15 minutes';
  insert into public.import_locks (association_id, kind, claimed_by, claimed_at)
  values (p_association_id, p_kind, auth.uid(), now())
  on conflict (association_id, kind) do nothing;
  return found;
end $function$;

revoke all on function public.claim_import_lock(uuid, text) from public, anon;
grant execute on function public.claim_import_lock(uuid, text) to authenticated;
