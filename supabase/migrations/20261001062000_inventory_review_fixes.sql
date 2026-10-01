-- #101 review 2: unknown unit cost stays unknown in the inventory reports
-- (not a confirmed $0), and reorder points can't be negative.
alter table public.inventory_items drop constraint if exists inventory_items_reorder_point_nonneg;
alter table public.inventory_items add constraint inventory_items_reorder_point_nonneg check (reorder_point is null or reorder_point >= 0);

do $$
declare def text;
begin
  def := pg_get_functiondef('public.report_data_inventory_status(uuid, jsonb)'::regprocedure);
  if def !~ 'round\(coalesce\(i\.unit_cost, 0\) \* i\.quantity_on_hand, 2\)' then
    raise exception 'inventory_review_fixes: report_data_inventory_status drifted';
  end if;
  execute replace(def, 'round(coalesce(i.unit_cost, 0) * i.quantity_on_hand, 2)', 'round(i.unit_cost * i.quantity_on_hand, 2)');

  def := pg_get_functiondef('public.report_data_inventory_usage(uuid, jsonb)'::regprocedure);
  if def !~ 'round\(coalesce\(m\.unit_cost, 0\) \* -m\.quantity_change, 2\)' then
    raise exception 'inventory_review_fixes: report_data_inventory_usage drifted';
  end if;
  execute replace(def, 'round(coalesce(m.unit_cost, 0) * -m.quantity_change, 2)', 'round(m.unit_cost * -m.quantity_change, 2)');
end $$;
