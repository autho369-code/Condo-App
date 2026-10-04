-- Maintenance response times report: first-reply SLA, time to resolve, work
-- order completion time and open work-order aging. Rendered live on
-- /reports/maintenance_response_times; queued CSV/Excel/PDF runs use the
-- app-side generator (lib/reports/live-export.ts), not report_data_dispatch.
insert into public.report_definitions (slug, name, category, description, output_formats, is_system, active)
values (
  'maintenance_response_times',
  'Maintenance Response Times',
  'maintenance',
  'How fast service requests get a first reply and get resolved, and how fast work orders get completed, by association and priority.',
  array['pdf', 'xlsx', 'csv']::public.report_format[],
  true,
  true
)
on conflict (slug) do nothing;
