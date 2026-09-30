-- SECURITY: email_queue_staff_all allowed ANY authenticated user (owners,
-- vendors, board) to read and insert rows whose association_id is null.
-- Inserted rows are delivered by the queue cron from the verified
-- portier369.com sender, so this was an open relay, and null-association
-- rows (company/platform mail) were readable across tenants.
-- Rows are now visible/writable only to the platform operator, or to staff
-- and company admins of the row's association or portfolio. Every staff code
-- path already sets portfolio_id; system mail uses the service role.

drop policy if exists email_queue_staff_all on public.email_queue;
create policy email_queue_staff_all on public.email_queue
  for all to authenticated
  using (
    public.is_platform_operator()
    or (association_id is not null and public.can_access_association(association_id))
    or (association_id is null and portfolio_id is not null and public.can_access_portfolio(portfolio_id))
  )
  with check (
    public.is_platform_operator()
    or (association_id is not null and public.can_access_association(association_id))
    or (association_id is null and portfolio_id is not null and public.can_access_portfolio(portfolio_id))
  );

revoke all on public.email_queue from anon;
