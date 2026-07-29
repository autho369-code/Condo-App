-- Links a parking assignment to the recurring charge it auto-created on the unit,
-- so releasing the space also ends the monthly billing.
alter table public.parking_assignments
  add column if not exists recurring_charge_id uuid
  references public.unit_recurring_charges(id) on delete set null;;
