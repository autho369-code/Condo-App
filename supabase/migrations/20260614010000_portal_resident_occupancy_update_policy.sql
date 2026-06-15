-- Residents (owner portal) can update lease move-in/out dates on their OWN current occupancy.
-- Previously residents had SELECT-only (occupancies_self_read), so the lease page's
-- updateLease() server action silently no-opped under RLS.
drop policy if exists occupancies_self_update on public.occupancies;
create policy occupancies_self_update on public.occupancies
  for update
  using (
    is_portal_resident()
    and owner_id = current_owner_id()
    and status = 'current'
  )
  with check (
    is_portal_resident()
    and owner_id = current_owner_id()
  );
