-- The association calendar is visible to every owner and tenant of the
-- association (unchanged behavior; a narrower rule applied briefly was
-- reverted). This restates the policies as they stand.

alter policy calendar_events_resident_read on public.calendar_events
  using (
    public.is_portal_resident()
    and archived_at is null
    and (association_id in (select public.current_resident_association_ids())
         or (association_id is null and portfolio_id = public.current_portfolio_id()))
  );

alter policy calendar_events_tenant_read on public.calendar_events
  using (
    public.is_tenant_user()
    and archived_at is null
    and (association_id in (select public.current_tenant_association_ids())
         or (association_id is null and portfolio_id = public.current_portfolio_id()))
  );
