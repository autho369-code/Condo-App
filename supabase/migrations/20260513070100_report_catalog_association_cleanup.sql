-- Keep the active report catalog aligned with the association-only workflow:
-- properties => associations, homeowners => owners, tenants => renters, no lease reports.

update public.report_definitions
set active = false
where
  slug ilike '%lease%'
  or name ilike '%lease%'
  or coalesce(description, '') ilike '%lease%';

update public.report_definitions
set
  name = replace(replace(replace(replace(replace(replace(replace(replace(name,
    'Homeowners', 'Owners'),
    'Homeowner', 'Owner'),
    'homeowners', 'owners'),
    'homeowner', 'owner'),
    'Properties', 'Associations'),
    'Property', 'Association'),
    'properties', 'associations'),
    'property', 'association'),
  description = replace(replace(replace(replace(replace(replace(replace(replace(coalesce(description, ''),
    'Homeowners', 'Owners'),
    'Homeowner', 'Owner'),
    'homeowners', 'owners'),
    'homeowner', 'owner'),
    'Properties', 'Associations'),
    'Property', 'Association'),
    'properties', 'associations'),
    'property', 'association');

update public.report_definitions
set
  name = replace(replace(replace(replace(name,
    'Tenants', 'Renters'),
    'Tenant', 'Renter'),
    'tenants', 'renters'),
    'tenant', 'renter'),
  description = replace(replace(replace(replace(coalesce(description, ''),
    'Tenants', 'Renters'),
    'Tenant', 'Renter'),
    'tenants', 'renters'),
    'tenant', 'renter')
where category = 'communication';
