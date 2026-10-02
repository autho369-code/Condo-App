-- Owner portal fixes.
--
-- 1. Residents cannot read community work orders through RLS, so the portal's
--    "emergency work in progress" banner never showed. owner_open_emergencies()
--    returns only the title + created_at of open emergency-priority work orders
--    in associations where the caller currently occupies a unit as an owner.
--
-- 2. One-time form tokens (form_submissions) were staff-only to insert, so the
--    owner portal could not use them to stop double-submitted service requests
--    and concern reports. Owners linked to the signed-in user may now claim
--    tokens for those two kinds only.

create or replace function public.owner_open_emergencies()
returns table (title text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select wo.title, wo.created_at
  from public.work_orders wo
  where wo.priority = 'emergency'
    and wo.archived_at is null
    and wo.status not in ('done', 'completed', 'billed', 'closed', 'cancelled')
    and wo.association_id in (
      select o.association_id
      from public.occupancies o
      join public.owners ow on ow.id = o.owner_id
      where ow.auth_user_id = auth.uid()
        and ow.archived_at is null
        and o.status = 'current'
    )
  order by wo.created_at desc
  limit 5
$$;

revoke all on function public.owner_open_emergencies() from public;
revoke all on function public.owner_open_emergencies() from anon;
grant execute on function public.owner_open_emergencies() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'form_submissions'
      and policyname = 'form_submissions_owner_insert'
  ) then
    create policy form_submissions_owner_insert on public.form_submissions
      for insert to authenticated
      with check (
        created_by = auth.uid()
        and kind in ('portal_service_request', 'portal_concern_report')
        and exists (select 1 from public.owners ow where ow.auth_user_id = auth.uid() and ow.archived_at is null)
      );
  end if;
end $$;
