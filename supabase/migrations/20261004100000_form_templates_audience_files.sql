-- Forms: who a form is for, an uploaded file, and owner-portal read access.
--
-- audience  'homeowner' forms are listed in the owner portal; 'vendor' and
--           'internal' forms are staff-only for now.
-- file_path object path in the private association-documents bucket
--           (forms/<portfolio_id>/<uuid>.<ext>); downloads use short-lived
--           signed URLs. file_url stays for forms that link elsewhere.

alter table public.form_templates
  add column if not exists audience text not null default 'homeowner',
  add column if not exists file_path text,
  add column if not exists file_name text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'form_templates_audience_check') then
    alter table public.form_templates
      add constraint form_templates_audience_check check (audience in ('homeowner', 'vendor', 'internal'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'form_templates_file_path_check') then
    alter table public.form_templates
      add constraint form_templates_file_path_check
      check (file_path is null or file_path like 'forms/' || portfolio_id::text || '/%');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'form_templates_file_url_check') then
    alter table public.form_templates
      add constraint form_templates_file_url_check check (file_url is null or file_url ~* '^https://');
  end if;
end $$;

-- Owners with an activated portal read the active homeowner forms of their
-- own management company. Staff access is unchanged (form_templates_staff_all).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'form_templates' and policyname = 'form_templates_owner_read'
  ) then
    create policy form_templates_owner_read on public.form_templates
      for select to authenticated
      using (
        active
        and archived_at is null
        and audience = 'homeowner'
        and exists (
          select 1 from public.owners o
          where o.auth_user_id = auth.uid()
            and o.archived_at is null
            and o.portal_activated
            and o.portfolio_id = form_templates.portfolio_id
        )
      );
  end if;
end $$;
