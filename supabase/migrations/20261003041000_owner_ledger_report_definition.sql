-- The Owner Ledger report (slug owner_ledger) exists in production but was
-- never seeded by a repo migration, so fresh databases and the route audit did
-- not know it. Seed it as production has it; a no-op where it already exists.
do $$
begin
  if not exists (select 1 from public.report_definitions where slug = 'owner_ledger' and portfolio_id is null) then
    insert into public.report_definitions (portfolio_id, slug, name, category, description, parameter_schema, default_filters, output_formats, is_system, active) values (null, 'owner_ledger', 'Owner Ledger', 'association', 'Owner ledger activity and balances.', '{}', '{}', '{pdf,xlsx,csv}', true, true);
  end if;
end;
$$;
