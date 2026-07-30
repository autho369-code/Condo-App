-- ============================================================================
-- Add assistant_manager and accountant to mvp_company_role enum
-- ============================================================================
-- Final role spec:
--   company_admin       — full company access; invites and assigns staff
--   manager             — assigned associations only; full edit rights
--   assistant_manager   — assigned associations only; VIEW ONLY
--   accountant          — all associations in company; full access
-- (board members, owners, tenants are tracked in their own dedicated tables)

ALTER TYPE public.mvp_company_role ADD VALUE IF NOT EXISTS 'assistant_manager';
ALTER TYPE public.mvp_company_role ADD VALUE IF NOT EXISTS 'accountant';

COMMENT ON TYPE public.mvp_company_role IS
  'Company-level staff roles. company_admin & accountant see all associations in the portfolio. manager & assistant_manager see only associations assigned via association_managers (assistant_manager has read-only enforcement at the application layer).';;
