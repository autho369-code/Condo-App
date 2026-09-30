-- The FKs first added by management_fee_run gave PostgREST a second
-- vendors<->portfolios (and gl_accounts<->portfolios) relationship, making
-- existing embeds such as vendors(portfolios(company_name)) ambiguous
-- (PGRST201) — vendor document requests failed for ~5 minutes. The columns
-- stay; run_management_fees validates both ids against the caller's company.
alter table public.portfolios drop constraint if exists portfolios_management_fee_vendor_id_fkey;
alter table public.portfolios drop constraint if exists portfolios_management_fee_gl_account_id_fkey;
notify pgrst, 'reload schema';
