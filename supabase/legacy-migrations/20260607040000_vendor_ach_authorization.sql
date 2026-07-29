-- Vendor ACH authorization workflow
-- Adds status tracking, verification timestamp, and auditor columns

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS ach_status text NOT NULL DEFAULT 'pending'
    CHECK (ach_status IN ('pending', 'verified', 'active')),
  ADD COLUMN IF NOT EXISTS ach_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS ach_verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS ach_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ach_activated_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.vendors.ach_status IS 'ACH authorization status: pending → verified → active';
COMMENT ON COLUMN public.vendors.ach_verified_at IS 'Timestamp when bank account was verified by staff';
COMMENT ON COLUMN public.vendors.ach_verified_by IS 'Staff user who verified the bank account';
COMMENT ON COLUMN public.vendors.ach_activated_at IS 'Timestamp when ACH payments were activated';
COMMENT ON COLUMN public.vendors.ach_activated_by IS 'Staff user who activated ACH payments';

-- Set existing vendors with bank info to pending status
UPDATE public.vendors
SET ach_status = 'pending'
WHERE ach_status IS NULL
  AND bank_routing_number IS NOT NULL
  AND bank_account_number IS NOT NULL;
