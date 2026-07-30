alter table public.associations
  add column if not exists legal_name text,
  add column if not exists tax_id text;

comment on column public.associations.legal_name is 'Registered legal name of the HOA/Condo corporation (if different from display name).';
comment on column public.associations.tax_id    is 'Federal EIN / tax identification number for the legal entity.';;
