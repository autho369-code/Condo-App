-- Objects production has on Supabase-managed schemas (auth, storage), which a
-- public-schema dump leaves out. Copied from production (pg_trigger, pg_policy,
-- storage.buckets) on 2026-10-25.

-- Sign-up triggers on auth.users.
create trigger trg_apply_pending_invitation after insert on auth.users for each row execute function public.apply_pending_invitation();
create trigger trg_auto_link_portal_user after insert on auth.users for each row execute function public.auto_link_portal_user();
create trigger trg_handle_new_auth_user after insert on auth.users for each row execute function public.handle_new_auth_user();
create trigger trg_relink_portal_user_on_email after update of email on auth.users for each row execute function public.relink_portal_user_on_email_change();

-- File buckets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('data-exports', 'data-exports', false, 524288000, array['application/zip', 'application/json', 'text/csv']),
  ('tenant-logos', 'tenant-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']),
  ('association-documents', 'association-documents', false, 26214400, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv']),
  ('reports', 'reports', false, 20971520, array['application/pdf', 'text/csv', 'application/json', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

-- File access policies.
create policy operator_writes_need_admin_update on storage.objects as restrictive for update to authenticated using (public.operator_may_write(false)) with check (public.operator_may_write(false));
create policy operator_writes_need_admin_delete on storage.objects as restrictive for delete to authenticated using (public.operator_may_write(false));
create policy operator_writes_need_admin_insert on storage.objects as restrictive for insert to authenticated with check (public.operator_may_write(false));
create policy reports_service_role_write on storage.objects as permissive for all to service_role using (bucket_id = 'reports') with check (bucket_id = 'reports');
create policy data_exports_service_role_write on storage.objects as permissive for all to service_role using (bucket_id = 'data-exports') with check (bucket_id = 'data-exports');
create policy "association documents insert own portfolio" on storage.objects as permissive for insert to authenticated
  with check (bucket_id = 'association-documents' and public.is_full_access_staff() and (storage.foldername(name))[1] = coalesce(public.current_portfolio_id()::text, '__none__'));
create policy "association documents read own portfolio" on storage.objects as permissive for select to authenticated
  using (bucket_id = 'association-documents' and (((public.is_staff() or public.is_platform_operator()) and (storage.foldername(name))[1] = coalesce(public.current_portfolio_id()::text, '__none__'))
    or exists (select 1 from public.association_attachments aa where aa.storage_path = objects.name and aa.shared_with_owner and aa.archived_at is null
               and aa.association_id in (select public.current_resident_association_ids()))));
create policy data_exports_subject_read on storage.objects as permissive for select to authenticated
  using (bucket_id = 'data-exports' and (public.is_platform_operator() or (split_part(name, '/', 1)::uuid = public.current_portfolio_id() and public.is_full_access_staff())));
create policy reports_staff_read on storage.objects as permissive for select to authenticated
  using (bucket_id = 'reports' and (public.is_platform_operator() or exists (select 1 from public.report_runs r
    where r.id::text = split_part(split_part(objects.name, '/', 2), '.', 1) and r.portfolio_id::text = split_part(objects.name, '/', 1))));
create policy "tenant-logos delete own portfolio" on storage.objects as permissive for delete to authenticated
  using (bucket_id = 'tenant-logos' and (public.is_full_access_staff() or public.is_company_admin()) and (storage.foldername(name))[1] = coalesce(public.current_portfolio_id()::text, '__none__'));
create policy "tenant-logos insert own portfolio" on storage.objects as permissive for insert to authenticated
  with check (bucket_id = 'tenant-logos' and (public.is_full_access_staff() or public.is_company_admin()) and (storage.foldername(name))[1] = coalesce(public.current_portfolio_id()::text, '__none__'));
create policy "tenant-logos update own portfolio" on storage.objects as permissive for update to authenticated
  using (bucket_id = 'tenant-logos' and (public.is_full_access_staff() or public.is_company_admin()) and (storage.foldername(name))[1] = coalesce(public.current_portfolio_id()::text, '__none__'));
