-- These system reports exist in production (and are linked from the
-- association panel) but were created directly in the live database, or by a
-- `select ... from (values ...)` insert the route audit cannot parse. Record
-- them so a fresh database matches production. Existing rows are untouched.
do $$
begin
  begin
    insert into public.report_definitions (slug, name, category, description, parameter_schema, default_filters, output_formats, is_system, active, portfolio_id)
    values ('unit_directory', 'Unit Directory', 'property_unit', 'Unit directory by association and building.', '{}', '{}', '{pdf,xlsx,csv}', true, true, null);
  exception when unique_violation then null;
  end;
  begin
    insert into public.report_definitions (slug, name, category, description, parameter_schema, default_filters, output_formats, is_system, active, portfolio_id)
    values ('resident_directory', 'Resident Directory', 'association', 'Resident contact directory.', '{}', '{}', '{pdf,xlsx,csv}', true, true, null);
  exception when unique_violation then null;
  end;
  begin
    insert into public.report_definitions (slug, name, category, description, parameter_schema, default_filters, output_formats, is_system, active, portfolio_id)
    values ('association_directory', 'Association Directory', 'property_unit', 'Association and association directory.', '{}', '{}', '{pdf,xlsx,csv}', true, true, null);
  exception when unique_violation then null;
  end;
  begin
    insert into public.report_definitions (slug, name, category, description, parameter_schema, default_filters, output_formats, is_system, active, portfolio_id)
    values ('budget_association_comparison', 'Budget - Association Comparison', 'accounting', 'Annual budget by GL account, one column per association.', '{}', '{}', '{pdf,csv}', true, true, null);
  exception when unique_violation then null;
  end;
end $$;
