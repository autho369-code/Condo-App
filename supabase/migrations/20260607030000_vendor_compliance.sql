-- Vendor compliance tracking per AppFolio schematic §3.7
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS workers_comp_expiration date,
  ADD COLUMN IF NOT EXISTS general_liability_expiration date,
  ADD COLUMN IF NOT EXISTS epa_certification_expiration date,
  ADD COLUMN IF NOT EXISTS auto_insurance_expiration date,
  ADD COLUMN IF NOT EXISTS state_license_expiration date,
  ADD COLUMN IF NOT EXISTS contract_expiration date;

COMMENT ON COLUMN public.vendors.workers_comp_expiration IS 'Workers compensation insurance expiration';
COMMENT ON COLUMN public.vendors.general_liability_expiration IS 'General liability insurance expiration';
COMMENT ON COLUMN public.vendors.epa_certification_expiration IS 'EPA certification expiration';
COMMENT ON COLUMN public.vendors.auto_insurance_expiration IS 'Auto insurance expiration';
COMMENT ON COLUMN public.vendors.state_license_expiration IS 'State trade license expiration';
COMMENT ON COLUMN public.vendors.contract_expiration IS 'Service contract expiration';
