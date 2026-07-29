
-- leads / lead_messages / bookings and the providers/services marketplace tables
-- are UNUSED by the app (zero code refs) and EMPTY, yet had public USING(true)
-- SELECT/UPDATE/INSERT policies (lead PII world-readable/editable). The demo form
-- only emails via Resend; nothing writes these tables. Drop all the permissive
-- public policies — RLS stays enabled (deny-all to clients), which is correct for
-- unused tables. Re-add scoped policies if/when a real feature uses them.
-- Applied to remote 2026-06-22.
drop policy if exists leads_insert on public.leads;
drop policy if exists leads_select on public.leads;
drop policy if exists leads_update on public.leads;

drop policy if exists messages_insert on public.lead_messages;
drop policy if exists messages_select on public.lead_messages;

drop policy if exists bookings_insert on public.bookings;
drop policy if exists bookings_select on public.bookings;
drop policy if exists bookings_update on public.bookings;

drop policy if exists providers_select on public.providers;
drop policy if exists provider_services_select on public.provider_services;
drop policy if exists availability_select on public.provider_availability;
drop policy if exists services_select on public.services;
;
