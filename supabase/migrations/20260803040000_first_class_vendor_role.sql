-- Vendor identities must not masquerade as owners. Keeping the role explicit
-- prevents a same-email vendor contact from inheriting owner portal policies.
alter type public.hoa_role add value if not exists 'vendor';

comment on type public.hoa_role is
  'Primary workspace role for management staff, board members, owners, residents, company admins, and vendors.';
