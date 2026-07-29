-- Fields from AppFolio's New Property form that we didn't already have.
-- site_manager_phone   — Property Information section
-- vendor_1099_payer    — Reporting subsection (use_management_company | use_owner)
-- owner_payout_basis   — Reporting subsection (cash | accrual)
alter table public.associations
  add column if not exists site_manager_phone text,
  add column if not exists vendor_1099_payer text default 'use_management_company',
  add column if not exists owner_payout_basis text default 'cash';

-- Document the allowed values via a CHECK so bad inputs fail loudly
alter table public.associations
  drop constraint if exists associations_vendor_1099_payer_check,
  add  constraint associations_vendor_1099_payer_check
    check (vendor_1099_payer in ('use_management_company','use_owner'));

alter table public.associations
  drop constraint if exists associations_owner_payout_basis_check,
  add  constraint associations_owner_payout_basis_check
    check (owner_payout_basis in ('cash','accrual'));

comment on column public.associations.site_manager_phone is 'Phone number for the on-site manager (free-text).';
comment on column public.associations.vendor_1099_payer  is 'Who is the vendor 1099 payer for tax purposes: the management company or the owner.';
comment on column public.associations.owner_payout_basis  is 'Basis for owner payouts: cash or accrual.';;
