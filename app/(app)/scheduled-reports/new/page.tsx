import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { ScheduleFields } from '@/components/reports/schedule-fields';
import { Button } from '@/components/ui/button';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { loadScheduleOptions } from '@/lib/reports/schedule-options';
import { saveScheduledReport } from '@/lib/rpcs/scheduled-reports';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewScheduledReportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; report?: string; custom?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const options = await loadScheduleOptions(db);

  // Opened from a report or a custom report: start with it selected.
  const fromCustom = options.customReports.find((r) => r.id === sp.custom);
  const fromReport = options.definitions.find((d) => d.id === sp.report);
  const preset = fromCustom
    ? { source: `saved:${fromCustom.id}`, name: fromCustom.name }
    : fromReport
      ? { source: `def:${fromReport.id}`, name: fromReport.name }
      : null;

  return (
    <DataWorkspace
      title="New scheduled report"
      description="Run a report automatically and email it, on the schedule you choose."
      actions={<Link href="/scheduled-reports"><Button variant="secondary">Back to scheduled reports</Button></Link>}
    >
      <div className="max-w-3xl space-y-5">
        {sp.error && <Alert tone="danger" title="Could not schedule report">{sp.error}</Alert>}
        {options.error && <Alert tone="danger" title="Could not load every report">{options.error}</Alert>}
        <form action={saveScheduledReport}>
          <Surface>
            <ScheduleFields
              definitions={options.definitions}
              customReports={options.customReports}
              hours={options.hours}
              zoneLabel={options.zoneLabel}
              schedule={preset ? {
                ...preset,
                frequency: 'monthly',
                day_of_week: 1,
                day_of_month: 1,
                hour: 8,
                output_format: 'pdf',
                delivery_channel: 'email',
                delivery_targets: [],
              } : undefined}
            />
            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
              <Link href="/scheduled-reports" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
              <Button type="submit">Schedule report</Button>
            </div>
          </Surface>
        </form>
      </div>
    </DataWorkspace>
  );
}
