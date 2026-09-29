-- SECURITY: five tables granted ALL to any staff user with no tenant scope
-- (`is_staff() OR is_platform_operator()`), so staff at one management
-- company could read and write another company's records:
--   management_agreements, owner_ach_status, owner_form_submissions,
--   owner_packets, owner_portal_invites
-- Replace each with a portfolio-scoped staff policy. All five tables were
-- empty when this was written, so no cross-tenant data was exposed.

drop policy if exists "Staff manage agreements" on public.management_agreements;
drop policy if exists management_agreements_staff_tenant on public.management_agreements;
create policy management_agreements_staff_tenant on public.management_agreements
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id))
  with check (public.can_access_portfolio(portfolio_id));

drop policy if exists "Staff manage ACH status" on public.owner_ach_status;
drop policy if exists owner_ach_status_staff_tenant on public.owner_ach_status;
create policy owner_ach_status_staff_tenant on public.owner_ach_status
  for all to authenticated
  using (exists (select 1 from public.owners o where o.id = owner_ach_status.owner_id and public.can_access_portfolio(o.portfolio_id)))
  with check (exists (select 1 from public.owners o where o.id = owner_ach_status.owner_id and public.can_access_portfolio(o.portfolio_id)));

drop policy if exists "Staff manage form submissions" on public.owner_form_submissions;
drop policy if exists owner_form_submissions_staff_tenant on public.owner_form_submissions;
create policy owner_form_submissions_staff_tenant on public.owner_form_submissions
  for all to authenticated
  using (exists (select 1 from public.owners o where o.id = owner_form_submissions.owner_id and public.can_access_portfolio(o.portfolio_id)))
  with check (exists (select 1 from public.owners o where o.id = owner_form_submissions.owner_id and public.can_access_portfolio(o.portfolio_id)));

drop policy if exists "Staff manage packets" on public.owner_packets;
drop policy if exists owner_packets_staff_tenant on public.owner_packets;
create policy owner_packets_staff_tenant on public.owner_packets
  for all to authenticated
  using (exists (select 1 from public.owners o where o.id = owner_packets.owner_id and public.can_access_portfolio(o.portfolio_id)))
  with check (exists (select 1 from public.owners o where o.id = owner_packets.owner_id and public.can_access_portfolio(o.portfolio_id)));

drop policy if exists "Staff manage portal invites" on public.owner_portal_invites;
drop policy if exists owner_portal_invites_staff_tenant on public.owner_portal_invites;
create policy owner_portal_invites_staff_tenant on public.owner_portal_invites
  for all to authenticated
  using (exists (select 1 from public.owners o where o.id = owner_portal_invites.owner_id and public.can_access_portfolio(o.portfolio_id)))
  with check (exists (select 1 from public.owners o where o.id = owner_portal_invites.owner_id and public.can_access_portfolio(o.portfolio_id)));
