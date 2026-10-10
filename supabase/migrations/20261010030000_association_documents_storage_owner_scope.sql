-- The storage twin of #268 (20261009070000): the association-documents
-- bucket's read policy still matched owners by owners.auth_user_id and a
-- current occupancy, so a login whose portal staff had turned off, whose
-- record was archived, or whose company was suspended could still download
-- every shared association file straight from storage; records added through
-- owner_portal_logins got none. Owners now read a shared file only for an
-- association of current_resident_association_ids() (every active record of
-- the login, the same rule as the association_attachments table). The staff
-- branch is unchanged.

alter policy "association documents read own portfolio" on storage.objects
  using (
    bucket_id = 'association-documents'
    and (
      ((public.is_staff() or public.is_platform_operator())
        and (storage.foldername(name))[1] = coalesce(public.current_portfolio_id()::text, '__none__'))
      or exists (
        select 1
          from public.association_attachments aa
         where aa.storage_path = objects.name
           and aa.shared_with_owner
           and aa.archived_at is null
           and aa.association_id in (select public.current_resident_association_ids())
      )
    )
  );
