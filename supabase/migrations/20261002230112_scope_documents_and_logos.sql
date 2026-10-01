-- Association-scoped managers (association_managers rows) are limited by the
-- RESTRICTIVE mgr_assoc_scope policy on 71 tables, but not on documents,
-- owner_attachments or insurance_policies, so they could list (and the
-- document pages would sign download links for) every association's files.
-- Owner attachments are scoped through the owner's units.
--
-- tenant-logos (a public bucket) accepted uploads from any signed-in user
-- whose profile has the portfolio, owners and vendors included; writes now
-- need company staff with full access or a company admin.

create or replace function public.can_view_owner_row(p_owner uuid)
returns boolean
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $$
  select not public.manager_is_scoped()
      or exists (
        select 1
          from public.occupancies occ
          join public.association_managers am
            on am.association_id = occ.association_id and am.user_id = auth.uid()
         where occ.owner_id = p_owner
      );
$$;
revoke all on function public.can_view_owner_row(uuid) from public, anon;
grant execute on function public.can_view_owner_row(uuid) to authenticated, service_role;

create policy mgr_assoc_scope on public.documents as restrictive for all to authenticated
  using (entity_type is distinct from 'association' or public.can_view_association_row(entity_id))
  with check (entity_type is distinct from 'association' or public.can_view_association_row(entity_id));

create policy mgr_assoc_scope on public.insurance_policies as restrictive for all to authenticated
  using (public.can_view_association_row(association_id))
  with check (public.can_view_association_row(association_id));

create policy mgr_assoc_scope on public.owner_attachments as restrictive for all to authenticated
  using (public.can_view_owner_row(owner_id))
  with check (public.can_view_owner_row(owner_id));

alter policy "tenant-logos insert own portfolio" on storage.objects
  with check (bucket_id = 'tenant-logos'
    and (public.is_full_access_staff() or public.is_company_admin())
    and (storage.foldername(name))[1] = coalesce(public.current_portfolio_id()::text, '__none__'));
alter policy "tenant-logos update own portfolio" on storage.objects
  using (bucket_id = 'tenant-logos'
    and (public.is_full_access_staff() or public.is_company_admin())
    and (storage.foldername(name))[1] = coalesce(public.current_portfolio_id()::text, '__none__'));
alter policy "tenant-logos delete own portfolio" on storage.objects
  using (bucket_id = 'tenant-logos'
    and (public.is_full_access_staff() or public.is_company_admin())
    and (storage.foldername(name))[1] = coalesce(public.current_portfolio_id()::text, '__none__'));
