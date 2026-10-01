-- #101 review 3: inventory unit costs can't be negative (a negative cost
-- turned item values and report totals negative).
alter table public.inventory_items drop constraint if exists inventory_items_unit_cost_nonneg;
alter table public.inventory_items add constraint inventory_items_unit_cost_nonneg check (unit_cost is null or unit_cost >= 0);
alter table public.inventory_movements drop constraint if exists inventory_movements_unit_cost_nonneg;
alter table public.inventory_movements add constraint inventory_movements_unit_cost_nonneg check (unit_cost is null or unit_cost >= 0);
