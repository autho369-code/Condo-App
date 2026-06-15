-- Residents (owner portal) can add their OWN HO6 insurance policies.
-- Previously residents had SELECT-only ("Owners can view own"), so the insurance
-- page's uploadInsurance() insert silently failed under RLS.
drop policy if exists insurance_resident_insert on public.insurance_policies;
create policy insurance_resident_insert on public.insurance_policies
  for insert
  with check (
    is_portal_resident()
    and owner_id = current_owner_id()
  );
