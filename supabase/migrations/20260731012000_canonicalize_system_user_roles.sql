-- Existing global roles may predate the canonical system-role catalog. The
-- original seed used ON CONFLICT DO NOTHING, which left matching legacy rows
-- with is_system = false and made them unavailable to system-role lookups.
-- Upsert the complete catalog so every environment converges on the same
-- authorization metadata.
insert into public.user_roles (
  portfolio_id,
  name,
  description,
  is_system,
  profile_access
) values
  (null, 'President', 'Full system access for HOA president', true, array['association', 'property']),
  (null, 'Accountant', 'Accounting access: GL, bills, payments, journals', true, array['association', 'property']),
  (null, 'Property Manager', 'Operational management of associations and units', true, array['association', 'property']),
  (null, 'On-Site Manager', 'Day-to-day site operations, maintenance coordination', true, array['property']),
  (null, 'Leasing Agent', 'Leasing, occupancy, tenant communications', true, array['property']),
  (null, 'Accounts Payable', 'Bills, POs, vendor payments', true, array['association', 'property'])
on conflict (portfolio_id, name) do update
set description = excluded.description,
    is_system = excluded.is_system,
    profile_access = excluded.profile_access;
