-- Fixed asset details tracked per asset: when it was placed in service, when
-- its warranty ends, and its make, model and serial number.
alter table public.fixed_assets
  add column if not exists placed_in_service_date date,
  add column if not exists warranty_expiration_date date,
  add column if not exists make text,
  add column if not exists model text,
  add column if not exists serial_number text;
