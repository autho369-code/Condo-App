-- notices <-> notice_recipients RLS recursion:
--   notices.notices_resident_read subqueries notice_recipients, whose
--   notice_recipients_staff_all subqueries notices -> "infinite recursion
--   detected in policy for relation notices" (every notices query 500s;
--   the manager Documents page notices tab has been failing silently).
-- Break the cycle with a SECURITY DEFINER membership check (definer
-- functions bypass RLS internally, so no re-entry into the policy tree).

create or replace function public.is_notice_recipient(p_notice_id uuid)
  returns boolean
  language sql
  stable security definer
  set search_path to 'pg_catalog', 'public'
as $$
  select exists (
    select 1 from public.notice_recipients nr
    where nr.notice_id = p_notice_id
      and nr.owner_id = public.current_owner_id()
  );
$$;

revoke all on function public.is_notice_recipient(uuid) from anon;

drop policy if exists notices_resident_read on public.notices;
create policy notices_resident_read on public.notices
  for select to authenticated
  using (
    is_portal_resident()
    and status = 'sent'::notice_status
    and (
      association_id in (select current_resident_association_ids())
      or public.is_notice_recipient(id)
    )
  );
