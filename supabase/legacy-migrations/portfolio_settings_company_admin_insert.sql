-- FIX 3: portfolio_settings INSERT policy was platform-operator only, so a company admin's
-- first-time save (which INSERTs a new settings row) failed. Add a company-admin INSERT
-- policy scoped to their own portfolio, mirroring the existing SELECT/UPDATE policies.
create policy "Company admins can insert portfolio settings"
  on public.portfolio_settings
  for insert
  to public
  with check (
    (is_company_admin() and (
      (select profiles.portfolio_id from profiles where profiles.id = auth.uid()) = portfolio_id
    )) or is_platform_operator()
  );
