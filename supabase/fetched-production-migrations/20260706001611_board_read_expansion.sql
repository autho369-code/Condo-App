-- See supabase/migrations/20260705000005_board_read_expansion.sql

drop policy if exists insurance_policies_board_read on public.insurance_policies;
create policy insurance_policies_board_read on public.insurance_policies
  for select to authenticated
  using (
    is_board_user()
    and association_id in (select current_board_association_ids())
  );

drop policy if exists maintenance_tasks_board_read on public.maintenance_tasks;
create policy maintenance_tasks_board_read on public.maintenance_tasks
  for select to authenticated
  using (
    is_board_user()
    and association_id in (select current_board_association_ids())
  );

drop policy if exists documents_board_read on public.documents;
create policy documents_board_read on public.documents
  for select to authenticated
  using (
    is_board_user()
    and entity_type = 'association'
    and entity_id in (select current_board_association_ids())
  );

drop policy if exists payable_bills_board_read on public.payable_bills;
create policy payable_bills_board_read on public.payable_bills
  for select to authenticated
  using (
    is_board_user()
    and association_id in (select current_board_association_ids())
  );;
