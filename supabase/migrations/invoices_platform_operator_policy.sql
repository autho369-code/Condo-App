-- Operators bill companies by generating/managing invoices, but invoices only
-- had company-admin RLS, so operators could neither read nor write them. Add a
-- platform-operator ALL policy. Applied to remote DB 2026-06-15.
create policy invoices_platform_all on public.invoices
  for all to authenticated
  using (public.is_platform_operator())
  with check (public.is_platform_operator());
