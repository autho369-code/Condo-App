-- #101 review: quantity_on_hand is numeric(10,2); movements must use the same
-- precision or the ledger drifts from the displayed stock (0.015 received into
-- 1.00 stored 1.015 in the movement but 1.02 on the item). Quantities are
-- rounded to two decimals, and a quantity that rounds to zero is refused.
alter table public.inventory_movements
  alter column quantity_change type numeric(10, 2),
  alter column quantity_after type numeric(10, 2);

do $$
declare def text;
begin
  def := pg_get_functiondef('public.record_inventory_movement(uuid, text, numeric, text, uuid, numeric, text)'::regprocedure);
  if def !~ 'if p_quantity is null or p_quantity <= 0 then' then
    raise exception 'inventory_quantity_precision: record_inventory_movement drifted';
  end if;
  def := replace(def, 'if p_quantity is null or p_quantity <= 0 then',
                      'p_quantity := round(p_quantity, 2);' || chr(10) || '  if p_quantity is null or p_quantity <= 0 then');
  execute def;
end $$;
