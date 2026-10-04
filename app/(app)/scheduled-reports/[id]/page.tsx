import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { ScheduleFields } from '@/components/reports/schedule-fields';
import { Button } from '@/components/ui/button';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { describeSchedule, scheduleLocalHour } from '@/lib/reports/schedule';
import { loadScheduleOptions } from '@/lib/reports/schedule-options';
import { saveScheduledReport } from '@/lib/rpcs/scheduled-reports';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function EditScheduledReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = (await createClient()) as any;

  const { data: schedule } = await db
    .from('scheduled_reports')
    .select('id, name, definition_id, saved_report_id, frequency, day_of_week, day_of_month, hour_utc, local_hour, time_zone, output_format, delivery_channel, delivery_targets')
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle();
  if (!schedule) notFound();
  const options = await loadScheduleOptions(db);

  const source = schedule.saved_report_id ? `saved:${schedule.saved_report_id}` : `def:${schedule.definition_id}`;
  // Saving re-saves the schedule in the company's current time zone.
  const localHour = scheduleLocalHour(schedule, options.zone);

  return (
    <DataWorkspace
      title={schedule.name}
      description={describeSchedule(schedule, options.zone)}
      actions={<Link href="/scheduled-reports"><Button variant="secondary">Back to scheduled reports</Button></Link>}
    >
      <div className="max-w-3xl space-y-5">
        {sp.error && <Alert tone="danger" title="Could not save schedule">{sp.error}</Alert>}
        <Alert tone="info">Saving a change to the report, filters, format or recipients makes this schedule run with your access.</Alert>
        {options.error && <Alert tone="danger" title="Could not load every report">{options.error}</Alert>}
        <form action={saveScheduledReport}>
          <input type="hidden" name="schedule_id" value={schedule.id} />
          <Surface>
            <ScheduleFields
              definitions={options.definitions}
              customReports={options.customReports}
              hours={options.hours}
              zoneLabel={options.zoneLabel}
              schedule={{
                source,
                name: schedule.name,
                frequency: schedule.frequency,
                day_of_week: schedule.day_of_week,
                day_of_month: schedule.day_of_month,
                hour: localHour,
                output_format: schedule.output_format,
                delivery_channel: schedule.delivery_channel,
                delivery_targets: Array.isArray(schedule.delivery_targets) ? schedule.delivery_targets : [],
              }}
            />
            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
              <Link href="/scheduled-reports" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
              <Button type="submit">Save schedule</Button>
            </div>
          </Surface>
        </form>
      </div>
    </DataWorkspace>
  );
}
