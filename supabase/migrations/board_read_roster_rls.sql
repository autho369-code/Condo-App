-- Board members may VIEW (read-only) the roster of their OWN association(s):
-- owners, unit ownership, occupancies, and tenants. Needed so the board
-- delinquencies / directory pages can resolve owner names. All association-scoped.

-- owners: any owner tied to a unit (ownership or occupancy) in the board's association(s)
drop policy if exists owners_board_read on public.owners;
create policy owners_board_read on public.owners
  for select to authenticated
  using (
    public.is_board_user() and (
      exists (
        select 1 from public.unit_owners uo
        join public.units u on u.id = uo.unit_id
        join public.buildings b on b.id = u.building_id
        where uo.owner_id = owners.id
          and b.association_id in (select public.current_board_association_ids())
      )
      or exists (
        select 1 from public.occupancies o
        where o.owner_id = owners.id
          and o.association_id in (select public.current_board_association_ids())
      )
    )
  );

-- unit_owners: ownership rows for units in the board's association(s)
drop policy if exists unit_owners_board_read on public.unit_owners;
create policy unit_owners_board_read on public.unit_owners
  for select to authenticated
  using (
    public.is_board_user() and unit_id in (
      select u.id from public.units u
      join public.buildings b on b.id = u.building_id
      where b.association_id in (select public.current_board_association_ids())
    )
  );

-- occupancies: rows for the board's association(s)
drop policy if exists occupancies_board_read on public.occupancies;
create policy occupancies_board_read on public.occupancies
  for select to authenticated
  using (
    public.is_board_user()
    and association_id in (select public.current_board_association_ids())
  );

-- tenants: rows for the board's association(s)
drop policy if exists tenants_board_read on public.tenants;
create policy tenants_board_read on public.tenants
  for select to authenticated
  using (
    public.is_board_user()
    and association_id in (select public.current_board_association_ids())
  );
