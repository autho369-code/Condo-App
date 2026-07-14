-- Field capture for violations: managers file violations from their phone
-- while walking the property. Store where the observation was made so the
-- case record carries the exact spot (Google Maps link on the detail page).
-- Captured client-side via navigator.geolocation; all three are nullable —
-- GPS may be denied/unavailable and the violation is still valid.

alter table public.violations
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_accuracy_m double precision;

comment on column public.violations.location_lat is 'Latitude where the violation was observed (field capture, WGS84).';
comment on column public.violations.location_lng is 'Longitude where the violation was observed (field capture, WGS84).';
comment on column public.violations.location_accuracy_m is 'Reported GPS accuracy radius in meters at capture time.';
