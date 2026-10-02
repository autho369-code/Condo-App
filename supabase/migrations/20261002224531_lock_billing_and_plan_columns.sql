-- Company staff could write platform-owned billing state:
--  * portfolios_admin_own was FOR ALL with no column limits, so a full-access
--    manager could raise their own plan tier (unlocking paid features through
--    has_entitlement), un-suspend, archive or even delete the company row.
--    It is narrowed to UPDATE, and a trigger rejects changes to plan, status
--    and identity columns unless the platform operator (or the service role)
--    makes them.
--  * company admins had INSERT/UPDATE policies on invoices and billing_usage,
--    so they could mark their own platform invoice paid or raise their door
--    limit. Those tables are now read-only to company admins; the platform
--    operator writes them (operator policy / service role).
-- (Policies are disabled with ALTER POLICY rather than dropped.)

alter policy portfolios_admin_own on public.portfolios using (false) with check (false);
create policy portfolios_admin_update on public.portfolios
  for update to authenticated
  using (public.is_full_access_staff() and id = public.current_portfolio_id())
  with check (public.is_full_access_staff() and id = public.current_portfolio_id());

create or replace function public.portfolios_guard_platform_columns()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
begin
  if auth.uid() is null or public.is_platform_operator() then
    return new;
  end if;
  if new.tier is distinct from old.tier
     or new.entitlements is distinct from old.entitlements
     or new.archived_at is distinct from old.archived_at
     or new.suspended_at is distinct from old.suspended_at
     or new.suspension_reason is distinct from old.suspension_reason
     or new.slug is distinct from old.slug
     or new.created_by is distinct from old.created_by then
    raise exception 'Plan, status and account identity can only be changed by Portier369 support';
  end if;
  return new;
end $$;

create trigger portfolios_guard_platform_columns
  before update on public.portfolios
  for each row execute function public.portfolios_guard_platform_columns();

alter policy "Company admins can insert invoices" on public.invoices with check (false);
alter policy "Company admins can update invoices" on public.invoices using (false);
alter policy "Company admins can insert billing usage" on public.billing_usage with check (false);
alter policy "Company admins can update billing usage" on public.billing_usage using (false);
