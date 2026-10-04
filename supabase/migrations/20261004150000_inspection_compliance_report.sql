-- Inspection compliance report: inspections completed by their scheduled date,
-- overdue inspections, and open findings by severity. Rendered live on
-- /reports/inspection_compliance; queued CSV/Excel/PDF runs use the app-side
-- generator (lib/reports/live-export.ts), not report_data_dispatch.
insert into public.report_definitions (slug, name, category, description, output_formats, is_system, active)
values (
  'inspection_compliance',
  'Inspection Compliance',
  'maintenance',
  'Inspections completed by their scheduled date, overdue inspections, and open findings by severity, by association and inspection type.',
  array['pdf', 'xlsx', 'csv']::public.report_format[],
  true,
  true
)
on conflict (slug) do nothing;
