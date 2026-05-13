-- Association shared documents for manager and owner portal surfaces.
-- Stores governing documents, meeting minutes, notices, and related files.

create table if not exists public.association_attachments (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  content_type text,
  byte_size bigint,
  folder text,
  shared_with_owner boolean not null default true,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_association_attachments_association
  on public.association_attachments(association_id, created_at desc)
  where archived_at is null;

create index if not exists idx_association_attachments_owner_visible
  on public.association_attachments(association_id, shared_with_owner, created_at desc)
  where archived_at is null;

alter table public.association_attachments enable row level security;

drop policy if exists "staff can read association attachments" on public.association_attachments;
create policy "staff can read association attachments"
  on public.association_attachments for select
  to authenticated
  using (
    (public.is_staff() or public.is_platform_operator())
    and exists (
      select 1
      from public.associations a
      where a.id = association_attachments.association_id
        and (a.portfolio_id = public.current_portfolio_id() or public.is_platform_operator())
    )
  );

drop policy if exists "staff can manage association attachments" on public.association_attachments;
create policy "staff can manage association attachments"
  on public.association_attachments for all
  to authenticated
  using (
    public.is_full_access_staff()
    and exists (
      select 1
      from public.associations a
      where a.id = association_attachments.association_id
        and (a.portfolio_id = public.current_portfolio_id() or public.is_platform_operator())
    )
  )
  with check (
    public.is_full_access_staff()
    and exists (
      select 1
      from public.associations a
      where a.id = association_attachments.association_id
        and (a.portfolio_id = public.current_portfolio_id() or public.is_platform_operator())
    )
  );

drop policy if exists "owners can read shared association attachments" on public.association_attachments;
create policy "owners can read shared association attachments"
  on public.association_attachments for select
  to authenticated
  using (
    shared_with_owner
    and archived_at is null
    and exists (
      select 1
      from public.owners o
      join public.occupancies occ on occ.owner_id = o.id
      where o.auth_user_id = auth.uid()
        and occ.association_id = association_attachments.association_id
        and occ.status = 'current'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'association-documents',
  'association-documents',
  false,
  25 * 1024 * 1024,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "association documents read own portfolio" on storage.objects;
create policy "association documents read own portfolio"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'association-documents'
    and (
      (
        (public.is_staff() or public.is_platform_operator())
        and (storage.foldername(name))[1] = coalesce(public.current_portfolio_id()::text, '__none__')
      )
      or exists (
        select 1
        from public.association_attachments aa
        join public.owners o on o.auth_user_id = auth.uid()
        join public.occupancies occ on occ.owner_id = o.id and occ.association_id = aa.association_id
        where aa.storage_path = storage.objects.name
          and aa.shared_with_owner
          and aa.archived_at is null
          and occ.status = 'current'
      )
    )
  );

drop policy if exists "association documents insert own portfolio" on storage.objects;
create policy "association documents insert own portfolio"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'association-documents'
    and public.is_full_access_staff()
    and (storage.foldername(name))[1] = coalesce(public.current_portfolio_id()::text, '__none__')
  );
