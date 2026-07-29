-- Field violation capture (AppFolio parity: mobile violation submission with GPS).
alter table public.violations
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_accuracy_m double precision;;
