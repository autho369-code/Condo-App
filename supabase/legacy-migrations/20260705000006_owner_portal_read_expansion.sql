-- Owner portal "My Home" + "Vehicles": residents can see their OWN parking
-- assignments, the spaces they reference, and their registered pets.
-- SELECT-only; management stays staff-side.

drop policy if exists parking_assignments_resident_read on public.parking_assignments;
create policy parking_assignments_resident_read on public.parking_assignments
  for select to authenticated
  using (
    is_portal_resident()
    and (
      owner_id = current_owner_id()
      or unit_id in (select current_resident_unit_ids())
    )
  );

drop policy if exists parking_spaces_resident_read on public.parking_spaces;
create policy parking_spaces_resident_read on public.parking_spaces
  for select to authenticated
  using (
    is_portal_resident()
    and association_id in (select current_resident_association_ids())
  );

drop policy if exists unit_pets_resident_read on public.unit_pets;
create policy unit_pets_resident_read on public.unit_pets
  for select to authenticated
  using (
    is_portal_resident()
    and (
      owner_id = current_owner_id()
      or unit_id in (select current_resident_unit_ids())
    )
  );
