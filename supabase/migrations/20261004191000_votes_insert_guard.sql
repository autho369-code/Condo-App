-- votes_resident_insert only checked owner_id, so an owner could cast a vote
-- on any ballot (another association's or company's included), for any unit,
-- with any weight. The app has no owner voting screen yet (0 votes); lock it
-- before one exists. Staff keep recording votes as before.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'votes' and policyname = 'votes_insert_guard') then
    create policy votes_insert_guard on public.votes
      as restrictive for insert to authenticated
      with check (
        exists (
          select 1 from public.ballots b
           where b.id = votes.ballot_id
             and (
               public.can_manage_association(b.association_id)
               or (
                 votes.owner_id = public.current_owner_id()
                 and votes.unit_id in (select public.current_resident_unit_ids())
                 and b.association_id in (select public.current_resident_association_ids())
                 and public.unit_association_id(votes.unit_id) = b.association_id
                 and b.status = 'open'
                 and b.archived_at is null
                 and (b.opens_at is null or b.opens_at <= now())
                 and (b.closes_at is null or b.closes_at > now())
                 and coalesce(votes.weight, 1) = 1
               )
             )
        )
      );
  end if;
end $$;

-- Vendors fill in the inspections assigned to them (inspections_vendor_rw is
-- FOR ALL, guarded on update by inspections_self_service_guard) but must not
-- create or delete inspections. Only staff do that.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inspections' and policyname = 'inspections_staff_create') then
    create policy inspections_staff_create on public.inspections
      as restrictive for insert to authenticated
      with check (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inspections' and policyname = 'inspections_staff_delete') then
    create policy inspections_staff_delete on public.inspections
      as restrictive for delete to authenticated
      using (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator());
  end if;
end $$;
