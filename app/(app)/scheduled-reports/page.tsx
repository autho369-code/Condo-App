import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Surface, SectionTitle } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { NewScheduleForm } from '@/components/reports/new-schedule-form';
import { createClient } from '@/lib/supabase/server';
import { toggleSchedule, deleteSchedule, runScheduleNow } from '@/lib/rpcs/reports';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ── Helpers ──
const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

export default async function ScheduledReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: schedules }, { data: definitions }] = await Promise.all([
    (supabase as any)
      .from('scheduled_reports')
      .select(`id, name, frequency, delivery_targets, delivery_channel, output_format, active, next_run_at, last_run_at, created_at, report_definitions(id, name, slug)`)
      .is('archived_at', null)
      .order('next_run_at', { ascending: true, nullsFirst: false }),
    (supabase as any)
      .from('report_definitions')
      .select('id, name, slug')
      .eq('active', true)
      .order('name'),
  ]);

  const rows = (schedules ?? []) as any[];
  const defs = (definitions ?? []) as { id: string; name: string; slug: string }[];

  const activeCount = rows.filter((r) => r.active).length;
  const pausedCount = rows.length - activeCount;

  return (
    <DataWorkspace
      title="Scheduled Reports"
      description="Configure reports to run automatically on a recurring schedule and email them to recipients."
      actions={
        <form action="/scheduled-reports" method="get" className="flex min-w-80 items-center gap-2">
          <input
            type="search"
            name="q"
            placeholder="Search schedules"
            aria-label="Search schedules"
            className="h-10 min-w-64 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      }
    >
      <div className="space-y-6">
        {sp.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <span className="font-semibold">Could not save schedule:</span> {sp.error}
          </div>
        )}

        <MetricStrip
          metrics={[
            { label: 'Active schedules', value: activeCount, sublabel: 'Running on cadence' },
            { label: 'Paused', value: pausedCount, sublabel: 'Inactive schedules' },
            { label: 'Total schedules', value: rows.length, sublabel: `${defs.length} available report definitions` },
            {
              label: 'Next due',
              value: rows.filter((r: any) => r.active && r.next_run_at).length,
              sublabel: 'Schedules with upcoming run',
            },
          ]}
        />

        {/* ── Create new schedule ── */}
        <Surface>
          <SectionTitle title="New scheduled report" description="Pick a report definition and a cadence; delivery happens automatically." />
          <div className="max-w-xl">
            <NewScheduleForm definitions={defs} />
          </div>
        </Surface>

        {/* ── Schedules table ── */}
        <section className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-950">All schedules</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {rows.length} schedule{rows.length !== 1 ? 's' : ''} configured
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600">
              {rows.length}
            </span>
          </div>

          {rows.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Report name</TH>
                  <TH>Frequency</TH>
                  <TH>Recipients</TH>
                  <TH>Last run</TH>
                  <TH>Next run</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <tbody>
                {rows.map((s: any) => (
                  <TR key={s.id}>
                    <TD className="font-medium text-gray-900">
                      <div>{s.name}</div>
                      <div className="text-xs text-gray-500">{s.report_definitions?.name}</div>
                    </TD>
                    <TD className="text-sm capitalize text-gray-700">
                      {FREQUENCY_LABELS[s.frequency] ?? s.frequency?.replace(/_/g, ' ')}
                    </TD>
                    <TD className="text-sm text-gray-600">
                      {Array.isArray(s.delivery_targets) && s.delivery_targets.length > 0
                        ? s.delivery_targets.slice(0, 3).join(', ') + (s.delivery_targets.length > 3 ? ` +${s.delivery_targets.length - 3} more` : '')
                        : s.delivery_channel
                          ? `Via ${s.delivery_channel.replace(/_/g, ' ')}`
                          : '\u2014'}
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">
                      {s.last_run_at ? date(s.last_run_at) : '\u2014'}
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-gray-900">
                      {s.next_run_at ? date(s.next_run_at) : '\u2014'}
                    </TD>
                    <TD>
                      <StatusChip tone={s.active ? 'success' : 'neutral'}>
                        {s.active ? 'Active' : 'Paused'}
                      </StatusChip>
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        {/* Run Now */}
                        <form action={runScheduleNow as any}>
                          <input type="hidden" name="id" value={s.id} />
                          <button
                            type="submit"
                            className="rounded-lg px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                          >
                            Run now
                          </button>
                        </form>

                        {/* Pause / Resume */}
                        <form action={toggleSchedule as any}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="active" value={String(s.active)} />
                          <button
                            type="submit"
                            className="rounded-lg px-2 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50"
                          >
                            {s.active ? 'Pause' : 'Resume'}
                          </button>
                        </form>

                        {/* Delete */}
                        <form action={deleteSchedule as any}>
                          <input type="hidden" name="id" value={s.id} />
                          <button
                            type="submit"
                            className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-gray-500">No scheduled reports yet.</p>
              <p className="mt-1 text-xs text-gray-400">
                Use the task panel to create a new scheduled report.
              </p>
            </div>
          )}
        </section>

        {/* ── Metrics section ── */}
        <section className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-950">Metrics</h2>
              <p className="mt-0.5 text-xs text-gray-500">Schedule health and delivery stats</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Active" value={activeCount} sub="Running schedules" />
            <MetricTile label="Paused" value={pausedCount} sub="Inactive schedules" />
            <MetricTile label="Definitions" value={defs.length} sub="Available reports" />
            <MetricTile
              label="Delivery"
              value={rows.filter((r: any) => r.delivery_channel === 'email').length}
              sub="Email-delivered"
            />
          </div>
        </section>
      </div>
    </DataWorkspace>
  );
}

// ── Shared UI ──
function MetricTile({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-gray-950">{value}</div>
      <div className="mt-0.5 text-xs text-gray-500">{sub}</div>
    </div>
  );
}
