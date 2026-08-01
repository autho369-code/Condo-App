-- The documents table predates vendor portal uploads and restricted doc_type
-- to resident/association categories. Preserve those values and explicitly
-- add the vendor categories used by compliance and invoice submissions.
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
      'vendor_invoice'::text
    ])
  );
