-- Leasing Agent and Accounts Payable were deliberately removed from the
-- Portier369 condo-management role catalog. Restore that product boundary
-- after the preceding catalog-normalization migration canonicalized all legacy
-- rows as system roles.
update public.user_roles
set is_system = false
where portfolio_id is null
  and name in ('Leasing Agent', 'Accounts Payable')
  and is_system is distinct from false;

comment on function public.is_finance_staff() is
  'Tier A staff roles plus Accountant; inactive role-catalog entries do not grant finance access.';
