-- Residents read violations on their unit, which let a unit's new owner (and
-- its tenants) read the previous owner's violations, hearing notes and board
-- decisions. The unit branch now only covers violations with no owner or ones
-- recorded against the unit's current owner.
alter policy violations_resident_read on public.violations
  using (
    public.is_portal_resident()
    and (
      owner_id = public.current_owner_id()
      or (
        unit_id in (select public.current_resident_unit_ids())
        and (
          owner_id is null
          or exists (
            select 1 from public.occupancies occ
             where occ.unit_id = violations.unit_id
               and occ.owner_id = violations.owner_id
               and occ.status = 'current'
               and occ.occupancy_type = 'owner')
        )
      )
    )
  );
