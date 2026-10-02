-- The Recurring Work Orders report exists in production (its data function is
-- in 20260928000200) but its report_definitions row was never seeded by a repo
-- migration. Seed it as production has it; a no-op where it already exists.
do $$
begin
  if not exists (select 1 from public.report_definitions where slug = 'recurring_work_orders' and portfolio_id is null) then
    insert into public.report_definitions (portfolio_id, slug, name, category, description, parameter_schema, default_filters, output_formats, is_system, active) values (null, 'recurring_work_orders', 'Recurring Work Orders', 'maintenance', 'Recurring work order templates and schedules.', '{}', '{}', '{pdf,xlsx,csv}', true, true);
  end if;
end;
$$;
