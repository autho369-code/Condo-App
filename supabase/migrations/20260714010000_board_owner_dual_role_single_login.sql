-- Single login for board members who are owners. Applied via MCP 2026-07-14.
-- Root cause: profiles.hoa_role is single-valued and is_portal_resident()
-- required 'owner' while is_board_user() required 'board' — one account could
-- never satisfy both portals' RLS at once.

-- 1. Board members who are also owners keep full resident access.
create or replace function public.is_portal_resident()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.hoa_role in ('owner','tenant')
        or (p.hoa_role = 'board' and public.current_owner_id() is not null)
      )
  );
$$;

-- 2. Board access flows directly from an active board_members row (matched by
-- auth_user_id or email), so marking an owner as a board member takes effect
-- immediately — no profile flip, no re-login required.
create or replace function public.is_board_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.hoa_role = 'board'
  )
  or exists (
    select 1 from public.board_members bm
    where bm.active and bm.auth_user_id = auth.uid()
  )
  or exists (
    select 1 from public.board_members bm
    join auth.users u on lower(u.email) = lower(bm.email)
    where u.id = auth.uid() and bm.active and bm.auth_user_id is null
  );
$$;

-- 3. Owners see scheduled board activity on their calendar (previously they
-- could only see completed meetings that already had minutes attached).
drop policy if exists meetings_portal_resident_read on public.meetings;
create policy meetings_portal_resident_read on public.meetings
  for select using (
    is_portal_resident()
    and association_id in (select current_resident_association_ids())
    and archived_at is null
    and (
      status = 'scheduled'
      or (status = 'completed' and minutes is not null)
    )
  );
