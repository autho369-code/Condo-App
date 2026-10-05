-- The operator write guard (20261005071000/072000) only covered the public
-- schema. Direct Supabase Storage API calls write storage.objects, whose
-- bucket policies (e.g. tenant-logos) authorize staff/company-admin profile
-- roles without excluding platform operators, and app-side checks never run
-- for those requests. Add the same rule on storage.objects: operators may
-- upload, replace or delete files only as admins. Non-operators unaffected.
-- Additive and idempotent.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'operator_writes_need_admin_insert') then
    create policy operator_writes_need_admin_insert on storage.objects
      as restrictive for insert to authenticated
      with check (public.operator_may_write(false));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'operator_writes_need_admin_update') then
    create policy operator_writes_need_admin_update on storage.objects
      as restrictive for update to authenticated
      using (public.operator_may_write(false)) with check (public.operator_may_write(false));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'operator_writes_need_admin_delete') then
    create policy operator_writes_need_admin_delete on storage.objects
      as restrictive for delete to authenticated
      using (public.operator_may_write(false));
  end if;
end $$;
