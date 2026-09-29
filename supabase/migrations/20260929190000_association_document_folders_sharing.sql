-- Association document folders + per-document sharing.
--
-- Before this, every association-level document was readable by every owner
-- of the association, including letters generated for one specific owner
-- (associations/<id>/generated/...). Documents now carry share_scope:
--   staff  - management only
--   board  - management + board members
--   owners - management + board + owners (tenants still limited to the
--            public governing-document types)
-- Other entity types (owner, unit, vendor) keep their existing visibility.

alter table public.documents
  add column if not exists folder text check (folder is null or length(btrim(folder)) between 1 and 60),
  add column if not exists share_scope text not null default 'owners' check (share_scope in ('staff', 'board', 'owners')),
  add column if not exists description text check (description is null or length(description) <= 500);

-- Backfill association documents: one-off generated letters become staff-only;
-- governing/financial/meeting records stay shared; anything else goes to the
-- board until a manager decides to share it with owners.
update public.documents set share_scope = 'staff', folder = coalesce(folder, 'Generated letters')
 where entity_type = 'association' and file_url like 'associations/%/generated/%';
update public.documents set folder = coalesce(folder, case
    when doc_type in ('declaration_ccrs', 'bylaws', 'articles_of_incorporation', 'rules_regulations') then 'Governing documents'
    when doc_type = 'operating_budget' then 'Financial'
    when doc_type = 'master_insurance_policy' then 'Insurance'
    when doc_type = 'minutes' then 'Meetings'
  end)
 where entity_type = 'association' and file_url not like 'associations/%/generated/%';
update public.documents set share_scope = 'board'
 where entity_type = 'association' and file_url not like 'associations/%/generated/%'
   and doc_type not in ('declaration_ccrs', 'bylaws', 'articles_of_incorporation', 'rules_regulations',
                        'master_insurance_policy', 'operating_budget', 'minutes');

create index if not exists documents_association_folder_idx on public.documents (entity_id, folder) where entity_type = 'association';

-- ── Read policies honour share_scope for association documents ──────────────
drop policy if exists documents_resident_tenant_read on public.documents;
create policy documents_resident_tenant_read on public.documents for select to authenticated
using (
  auth.uid() is not null and public.is_portal_resident()
  and public.document_path_matches_entity(entity_type, entity_id, file_url)
  and (
    (entity_type = 'owner' and entity_id = public.current_owner_id())
    or (entity_type = 'association' and share_scope = 'owners'
        and entity_id in (select public.current_resident_association_ids()))
    or (entity_type = 'unit' and exists (
          select 1 from public.occupancies oc
           where oc.unit_id = documents.entity_id and oc.owner_id = public.current_owner_id()
             and oc.status = 'current'::public.occupancy_status))
  )
);

drop policy if exists documents_tenant_read on public.documents;
create policy documents_tenant_read on public.documents for select to authenticated
using (
  public.is_tenant_user() and entity_type = 'association' and share_scope = 'owners'
  and entity_id in (select public.current_tenant_association_ids())
  and doc_type = any (array['declaration_ccrs', 'bylaws', 'articles_of_incorporation', 'rules_regulations', 'master_insurance_policy'])
  and public.document_path_matches_entity(entity_type, entity_id, file_url)
);

drop policy if exists documents_board_association_read on public.documents;
create policy documents_board_association_read on public.documents for select to authenticated
using (
  auth.uid() is not null and public.is_board_user() and entity_type = 'association'
  and share_scope in ('board', 'owners')
  and entity_id in (select public.current_board_association_ids())
  and public.document_path_matches_entity(entity_type, entity_id, file_url)
);

-- ── Staff edits (any staffer on the association, not just the uploader) ────
create or replace function public.update_association_document(
  p_document_id uuid, p_folder text, p_share_scope text, p_description text)
returns void
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare d record; v_portfolio uuid;
begin
  select * into d from public.documents where id = p_document_id and entity_type = 'association' for update;
  if not found or not public.can_manage_association(d.entity_id) then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;
  if p_share_scope not in ('staff', 'board', 'owners') then
    raise exception 'Choose who can see this document' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_folder, ''))) > 60 or length(coalesce(p_description, '')) > 500 then
    raise exception 'Folder names are limited to 60 characters and descriptions to 500' using errcode = '22023';
  end if;
  update public.documents
     set folder = nullif(btrim(p_folder), ''), share_scope = p_share_scope, description = nullif(btrim(p_description), '')
   where id = p_document_id;
  select portfolio_id into v_portfolio from public.associations where id = d.entity_id;
  if d.share_scope is distinct from p_share_scope or d.folder is distinct from nullif(btrim(p_folder), '') then
    insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
    values (v_portfolio, 'association', d.entity_id, 'document_sharing_updated', auth.uid(),
            (select email from auth.users where id = auth.uid()),
            jsonb_build_object('document_id', d.id, 'file_name', d.file_name,
                               'before', jsonb_build_object('folder', d.folder, 'share_scope', d.share_scope),
                               'after', jsonb_build_object('folder', nullif(btrim(p_folder), ''), 'share_scope', p_share_scope)));
  end if;
end $$;

-- Returns the storage path so the caller can remove the object afterwards.
create or replace function public.delete_association_document(p_document_id uuid)
returns text
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare d record; v_portfolio uuid;
begin
  select * into d from public.documents where id = p_document_id and entity_type = 'association' for update;
  if not found or not public.can_manage_association(d.entity_id) then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;
  delete from public.documents where id = p_document_id;
  select portfolio_id into v_portfolio from public.associations where id = d.entity_id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_portfolio, 'association', d.entity_id, 'document_deleted', auth.uid(),
          (select email from auth.users where id = auth.uid()),
          jsonb_build_object('document_id', d.id, 'file_name', d.file_name, 'doc_type', d.doc_type, 'folder', d.folder, 'share_scope', d.share_scope));
  return d.file_url;
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.update_association_document(uuid, text, text, text)', 'public.delete_association_document(uuid)'] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- Letters generated for specific owners are never shared automatically,
-- whatever code path inserts them.
create or replace function public.default_association_document_scope()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.entity_type = 'association' and new.file_url like 'associations/%/generated/%' and tg_op = 'INSERT' then
    new.share_scope := 'staff';
    new.folder := coalesce(new.folder, 'Generated letters');
  end if;
  return new;
end $$;
drop trigger if exists trg_default_association_document_scope on public.documents;
create trigger trg_default_association_document_scope before insert on public.documents
  for each row execute function public.default_association_document_scope();
revoke all on function public.default_association_document_scope() from public, anon, authenticated;
