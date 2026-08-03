-- Association operating-document uploads use explicit workflow categories.
-- The legacy documents constraint omitted those categories, allowing the
-- private storage upload to succeed before rejecting the metadata row. Extend
-- the closed allow-list and recover any valid orphaned operating uploads.

alter table public.documents
  drop constraint if exists documents_doc_type_check;

alter table public.documents
  add constraint documents_doc_type_check check (
    doc_type = any (array[
      'lease'::text,
      'ho6'::text,
      'renters_insurance'::text,
      'bylaws'::text,
      'minutes'::text,
      'other'::text,
      'workers_comp'::text,
      'general_liability'::text,
      'auto_insurance'::text,
      'epa_certification'::text,
      'state_license'::text,
      'contract'::text,
      'w9'::text,
      'vendor_invoice'::text,
      'declaration_ccrs'::text,
      'articles_of_incorporation'::text,
      'rules_regulations'::text,
      'operating_budget'::text,
      'master_insurance_policy'::text,
      'association_document'::text
    ])
  );

with parsed_orphans as (
  select
    o.name as file_url,
    substring(
      o.name from '^associations/([0-9a-fA-F-]{36})/operating/'
    )::uuid as association_id,
    substring(
      o.name from '/operating/([a-z0-9_]+)-[0-9]+-'
    ) as doc_type,
    substring(
      o.name from '/operating/[a-z0-9_]+-[0-9]+-(.+)$'
    ) as file_name,
    coalesce(o.created_at, now()) as uploaded_at
  from storage.objects o
  where o.bucket_id = 'association-documents'
    and o.name ~ '^associations/[0-9a-fA-F-]{36}/operating/[a-z0-9_]+-[0-9]+-.+$'
)
insert into public.documents (
  entity_type,
  entity_id,
  doc_type,
  file_name,
  file_url,
  uploaded_at,
  uploaded_by
)
select
  'association',
  orphan.association_id,
  orphan.doc_type,
  orphan.file_name,
  orphan.file_url,
  orphan.uploaded_at,
  null
from parsed_orphans orphan
join public.associations association on association.id = orphan.association_id
where orphan.doc_type = any (array[
    'declaration_ccrs'::text,
    'bylaws'::text,
    'articles_of_incorporation'::text,
    'rules_regulations'::text,
    'operating_budget'::text,
    'master_insurance_policy'::text,
    'association_document'::text
  ])
  and not exists (
    select 1
    from public.documents existing
    where existing.file_url = orphan.file_url
  );
