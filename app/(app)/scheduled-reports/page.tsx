import Link from 'next/link';
import { reportFormatLabel } from '@/lib/reports/formats';
import { ReportingTabs } from '@/components/reports/reporting-tabs';
import { Plus } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { StatusChip } from '@/components/operations/status-chip';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { describeSchedule } from '@/lib/reports/schedule';
import { archiveSchedule, setScheduleActive } from '@/lib/rpcs/scheduled-reports';
import { runScheduleNow } from '@/lib/rpcs/reports';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { displayTimeZone } from '@/lib/time/display-zone';
import { date } from '@/lib/utils';
import { PendingSubmit } from '@/components/ui/pending-submit';

export const dynamic = 'force-dynamic';

const SAVED_MESSAGES: Record<string, string> = {
  created: 'Report scheduled.',
  updated: 'Schedule saved.',
  paused: 'Schedule paused.',
  resumed: 'Schedule resumed.',
  deleted: 'Schedule deleted. Its past runs stay in Report history.',
};

export default async function ScheduledReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ran?: string; saved?: string; q?: string; status?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const status = sp.status === 'active' || sp.status === 'paused' ? sp.status : '';
  const db = (await createClient()) as any;
  const zone = displayTimeZone();

  const result = await fetchAllRows<any>(() => db
    .from('scheduled_reports')
    .select('id, name, frequency, day_of_week, day_of_month, hour_utc, local_hour, time_zone, delivery_targets, delivery_channel, output_format, active, next_run_at, last_run_at, created_by, run_as, saved_report_id, report_definitions(name), saved_reports(name)')
    .is('archived_at', null)
    .order('name')
    .order('id'));
  const rows = result.rows;

  // created_by / run_as reference auth.users, so names come from profiles separately.
  const creatorIds = [...new Set(rows.flatMap((r) => [r.created_by, r.run_as]).filter(Boolean))] as string[];
  const { data: creators } = creatorIds.length
    ? await db.from('profiles').select('id, full_name, email').in('id', creatorIds)
    : { data: [] };
  const creatorName = new Map<string, string>(((creators ?? []) as any[]).map((p) => [p.id, p.full_name ?? p.email ?? '—']));

  const ql = q.toLowerCase();
  const filtered = rows.filter((r) =>
    (!status || (status === 'active' ? r.active : !r.active)) &&
    (!ql || [r.name, r.report_definitions?.name, r.saved_reports?.name, ...(Array.isArray(r.delivery_targets) ? r.delivery_targets : [])]
      .some((v) => String(v ?? '').toLowerCase().includes(ql))));

  const when = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

  return (
    <DataWorkspace
      title="Scheduled Reports"
      description="Reports that run automatically on a schedule and are emailed to the people you choose. Each runs with the access of the person who last set its report or recipients."
      actions={
        <>
          <Link href="/reports/runs"><Button variant="secondary">Report history</Button></Link>
          <Link href="/scheduled-reports/new"><Button><Plus className="h-4 w-4" /> New scheduled report</Button></Link>
        </>
      }
    >
      <ReportingTabs current="scheduled" />
      <div className="space-y-4">
        {sp.ran && <Alert tone="success">Report run started. It appears in Report history when it finishes.</Alert>}
        {sp.saved && SAVED_MESSAGES[sp.saved] && <Alert tone="success">{SAVED_MESSAGES[sp.saved]}</Alert>}
        {sp.error && <Alert tone="danger" title="Something went wrong">{sp.error}</Alert>}
        {result.error && <Alert tone="danger" title="Could not load scheduled reports">{result.error}</Alert>}

        <FilterBar action="/scheduled-reports" searchDefault={q} searchPlaceholder="Search name, report or recipient...">
          <FilterSelect label="Status" name="status" defaultValue={status}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </FilterSelect>
        </FilterBar>

        {filtered.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Schedule</TH>
                <TH>Recipients</TH>
                <TH>Format</TH>
                <TH>Last run</TH>
                <TH>Next run</TH>
                <TH>Runs as</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <tbody>
              {filtered.map((s) => {
                const targets: string[] = Array.isArray(s.delivery_targets) ? s.delivery_targets : [];
                return (
                  <TR key={s.id}>
                    <TD className="font-medium text-gray-900">
                      <Link href={`/scheduled-reports/${s.id}`} className="underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900">{s.name}</Link>
                      <div className="text-xs text-gray-500">
                        {s.saved_report_id ? `Custom report: ${s.saved_reports?.name ?? 'removed'}` : s.report_definitions?.name}
                      </div>
                    </TD>
                    <TD className="text-sm text-gray-700">{describeSchedule(s, zone)}</TD>
                    <TD className="text-sm text-gray-600">
                      {s.delivery_channel === 'download_only'
                        ? 'Report history only'
                        : targets.length > 0
                          ? targets.slice(0, 3).join(', ') + (targets.length > 3 ? ` +${targets.length - 3} more` : '')
                          : '—'}
                    </TD>
                    <TD className="text-sm text-gray-600">{reportFormatLabel(String(s.output_format ?? ''))}</TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{s.last_run_at ? date(s.last_run_at) : '—'}</TD>
                    <TD className="whitespace-nowrap text-sm text-gray-900">{s.active ? when(s.next_run_at) : '—'}</TD>
                    <TD className="text-sm text-gray-600">{creatorName.get(s.run_as ?? s.created_by) ?? '—'}</TD>
                    <TD>
                      <StatusChip tone={s.active ? 'success' : 'neutral'}>{s.active ? 'Active' : 'Paused'}</StatusChip>
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/scheduled-reports/${s.id}`}><Button variant="secondary" size="sm">Edit</Button></Link>
                        {s.active && (
                          <form action={runScheduleNow as any}>
                            <input type="hidden" name="id" value={s.id} />
                            <Button type="submit" variant="secondary" size="sm">Run now</Button>
                          </form>
                        )}
                        <form action={setScheduleActive}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="active" value={s.active ? '0' : '1'} />
                          <Button type="submit" variant="secondary" size="sm">{s.active ? 'Pause' : 'Resume'}</Button>
                        </form>
                        <form action={archiveSchedule}>
                          <input type="hidden" name="id" value={s.id} />
                          <PendingSubmit variant="secondary" size="sm" pendingLabel="Deleting…" confirm="Delete this scheduled report? It will stop sending.">Delete</PendingSubmit>
                        </form>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              title={q || status ? 'No schedules match this filter' : 'No scheduled reports yet'}
              description="Schedule a report, or a custom report with its saved filters, to run and email automatically."
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
