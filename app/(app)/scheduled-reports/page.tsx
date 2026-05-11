import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ScheduledReportsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('scheduled_reports')
    .select('id, name, frequency, day_of_week, day_of_month, hour_utc, next_run_at, last_run_at, output_format, delivery_channel, active, report_definitions(name)')
    .is('archived_at', null)
    .order('next_run_at', { ascending: true, nullsFirst: false });

  return (
    <ModulePage title="Scheduled Reports" description="Reports that run automatically on a cadence and get emailed or saved to storage.">
      {rows && rows.length > 0 ? (
        <Table>
          <THead><TR><TH>Name</TH><TH>Report</TH><TH>Frequency</TH><TH>Next run</TH><TH>Last run</TH><TH>Format</TH><TH>Delivery</TH><TH>Active</TH></TR></THead>
          <tbody>
            {rows.map((s: any) => (
              <TR key={s.id}>
                <TD className="font-medium">{s.name}</TD>
                <TD className="text-sm text-ink-700">{s.report_definitions?.name}</TD>
                <TD className="text-sm capitalize">{s.frequency?.replace(/_/g, ' ')}</TD>
                <TD className="whitespace-nowrap text-sm">{date(s.next_run_at)}</TD>
                <TD className="whitespace-nowrap text-sm text-ink-600">{date(s.last_run_at)}</TD>
                <TD className="text-xs uppercase text-ink-500">{s.output_format}</TD>
                <TD className="text-sm capitalize text-ink-700">{s.delivery_channel}</TD>
                <TD>{s.active
                  ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">active</span>
                  : <span className="rounded bg-cream-100 px-2 py-0.5 text-xs text-ink-600">paused</span>}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="rounded border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">No scheduled reports configured.</p>
      )}
    </ModulePage>
  );
}
