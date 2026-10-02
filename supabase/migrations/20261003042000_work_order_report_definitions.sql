-- Work Order Labor Summary and Work Order Bill Detail exist in production (and
-- their data functions are in 20260928000200) but their report_definitions
-- rows were never seeded by a repo migration. Seed them as production has
-- them; a no-op where they already exist.
do $$
begin
  if not exists (select 1 from public.report_definitions where slug = 'work_order_labor_summary' and portfolio_id is null) then
    insert into public.report_definitions (portfolio_id, slug, name, category, description, parameter_schema, default_filters, output_formats, is_system, active) values (null, 'work_order_labor_summary', 'Work Order Labor Summary', 'maintenance', 'Labor summary by work order and vendor.', '{}', '{}', '{pdf,xlsx,csv}', true, true);
  end if;
  if not exists (select 1 from public.report_definitions where slug = 'work_order_bill_detail' and portfolio_id is null) then
    insert into public.report_definitions (portfolio_id, slug, name, category, description, parameter_schema, default_filters, output_formats, is_system, active) values (null, 'work_order_bill_detail', 'Work Order Bill Detail', 'maintenance', 'Bills associated with work orders.', '{}', '{}', '{pdf,xlsx,csv}', true, true);
  end if;
end;
$$;
