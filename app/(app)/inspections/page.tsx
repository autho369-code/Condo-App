import { fetchAllRows } from '@/lib/supabase/fetch-all';
import Link from 'next/link';
import { ClipboardCheck, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';
import { SelectAllCheckbox } from '@/components/ui/select-all';
import { markInspectionsDone } from '@/lib/rpcs/inspections-bulk';
import { todayInZone } from '@/lib/time/zoned';
import { displayTimeZone, isValidTimeZone } from '@/lib/time/display-zone';

export const dynamic = 'force-dynamic';

// ── Types ──
type Tab = 'all' | 'scheduled' | 'in_progress' | 'completed';
type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'all',         label: 'All' },
  { key: 'scheduled',   label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed',   label: 'Completed' },
];

// ── Helpers ──
function parseTab(value: string | undefined): Tab {
  return (TABS.find((t) => t.key === value)?.key as Tab) ?? 'all';
}

function tabFilter(tab: Tab): (r: any) => boolean {
  switch (tab) {
    case 'scheduled':   return (r) => r.status === 'scheduled';
    case 'in_progress': return (r) => r.status === 'in_progress';
    case 'completed':   return (r) => r.status === 'completed';
    case 'all':         return () => true;
  }
}

function statusChip(s: InspectionStatus | string | null): { label: string; tone: Tone } {
  switch (s) {
    case 'scheduled':   return { label: 'Scheduled',   tone: 'info' };
    case 'in_progress': return { label: 'In Progress',  tone: 'warning' };
    case 'completed':   return { label: 'Completed',    tone: 'success' };
    case 'cancelled':   return { label: 'Cancelled',    tone: 'neutral' };
    default:            return { label: s ?? '—',       tone: 'neutral' };
  }
}

function scoreBadge(score: number | null): { label: string; tone: Tone } {
  if (score === null) return { label: 'N/A', tone: 'neutral' };
  if (score >= 90) return { label: `${score}%`, tone: 'success' };
  if (score >= 75) return { label: `${score}%`, tone: 'warning' };
  return { label: `${score}%`, tone: 'danger' };
}

function computeScore(items: any[]): number | null {
  if (!items || items.length === 0) return null;
  const severityMap: Record<string, number> = {
    info: 100,
    minor: 80,
    moderate: 60,
    major: 40,
    critical: 20,
  };
  let total = 0;
  let count = 0;
  for (const item of items) {
    const sev = item.severity;
    if (sev && severityMap[sev] !== undefined) {
      total += severityMap[sev];
      count++;
    }
  }
  if (count === 0) return null;
  return Math.round(total / count);
}

// ── Page ──
export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; status?: string; type?: string; association_id?: string; scheduled?: string; marked?: string; skipped?: string; error?: string }>;
}) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const sp = await searchParams;
  const { tab: tabParam, q = '', status = '', type = '', association_id = '', scheduled: scheduledRaw } = sp;
  const scheduled = scheduledRaw && /^\d+$/.test(scheduledRaw) && scheduledRaw !== '0' ? scheduledRaw : null;
  const tab = parseTab(tabParam);

  // ── Fetch inspections + reference lists ──
  const [
    rowsRes,
    { data: associations },
    itemsRes,
  ] = await Promise.all([
    // Every inspection, paged past the old 500-row limit.
    fetchAllRows<any>(() => db.from('inspections')
      .select('id, inspection_type, association_id, unit_id, scheduled_date, inspector_vendor_id, inspector_user_id, status, notes, completed_date, created_at, associations(name), units(unit_number), vendors:inspector_vendor_id(name)')
      .is('archived_at', null)
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id')),
    db.from('associations').select('id, name, timezone').is('archived_at', null).order('name'),
    // Every finding (one request stops at 1,000 rows, so newer inspections'
    // scores went missing).
    fetchAllRows<any>(() => db.from('inspection_items').select('id, inspection_id, severity, resolved').order('created_at').order('id')),
  ]);

  const all = rowsRes.rows;
  // Flags and scores are only shown when every finding loaded; a partial set
  // would show undercounts that look exact.
  const itemsComplete = !itemsRes.error && !itemsRes.truncated;
  const items = itemsComplete ? itemsRes.rows : [];

  // ── Build score map from inspection_items ──
  const itemsByInspection = new Map<string, any[]>();
  for (const item of (items ?? [])) {
    const list = itemsByInspection.get(item.inspection_id) ?? [];
    list.push(item);
    itemsByInspection.set(item.inspection_id, list);
  }

  // Attach score to each inspection row
  // Flags: findings on the inspection that are not resolved yet.
  const scored = all.map((row: any) => ({
    ...row,
    score: itemsComplete ? computeScore(itemsByInspection.get(row.id) ?? []) : null,
    flags: itemsComplete ? (itemsByInspection.get(row.id) ?? []).filter((item: any) => !item.resolved).length : null,
  }));

  // ── Tab counts ──
  const tabCounts = Object.fromEntries(TABS.map((t) => [t.key, scored.filter(tabFilter(t.key)).length]));

  // ── Filter ──
  let filtered = scored.filter(tabFilter(tab));
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(
      (insp: any) =>
        (insp.inspection_type ?? '').toLowerCase().includes(ql) ||
        (insp.notes ?? '').toLowerCase().includes(ql) ||
        (insp.associations?.name ?? '').toLowerCase().includes(ql) ||
        (insp.units?.unit_number ?? '').toLowerCase().includes(ql) ||
        (insp.vendors?.name ?? '').toLowerCase().includes(ql),
    );
  }
  if (status) filtered = filtered.filter((insp: any) => insp.status === status);
  if (type) filtered = filtered.filter((insp: any) => insp.inspection_type === type);
  if (association_id) filtered = filtered.filter((insp: any) => insp.association_id === association_id);

  // ── Metrics ──
  const scheduledCount = scored.filter((insp: any) => insp.status === 'scheduled').length;
  const inProgressCount = scored.filter((insp: any) => insp.status === 'in_progress').length;
  const completedCount = scored.filter((insp: any) => insp.status === 'completed').length;
  // Each inspection is judged against today in its own association's time zone.
  const zoneByAssociation = new Map<string, string>(
    ((associations ?? []) as any[]).filter((a) => a.timezone && isValidTimeZone(a.timezone)).map((a) => [a.id, a.timezone]),
  );
  const todayFor = (associationId: string | null) => todayInZone(zoneByAssociation.get(associationId ?? '') ?? displayTimeZone());
  const overdueCount = scored.filter(
    // Date-only compare: an inspection scheduled today is not overdue.
    (insp: any) => insp.scheduled_date && insp.status === 'scheduled' && String(insp.scheduled_date).slice(0, 10) < todayFor(insp.association_id),
  ).length;

  const avgScore = (() => {
    const completed = scored.filter((insp: any) => insp.score !== null);
    if (completed.length === 0) return null;
    return Math.round(completed.reduce((sum: number, insp: any) => sum + (insp.score ?? 0), 0) / completed.length);
  })();

  const metrics = [
    { label: 'Scheduled', value: scheduledCount, sublabel: `${overdueCount} overdue` },
    { label: 'In Progress', value: inProgressCount, sublabel: 'Active inspections' },
    { label: 'Completed', value: completedCount, sublabel: `${avgScore !== null ? `Avg score: ${avgScore}%` : 'No scores yet'}` },
    { label: 'Total', value: scored.length, sublabel: 'All inspections' },
  ];

  // ── Unique inspection types for filter ──
  const types = [...new Set(scored.map((insp: any) => insp.inspection_type).filter(Boolean))] as string[];

  // ── Render ──
  return (
    <DataWorkspace
      title="Inspections"
      description="Schedule, track, and score property inspections across associations and units."
      actions={
        <div className="flex flex-wrap gap-2">
          {me.is_staff && <Link href="/inspections/templates"><Button variant="secondary">Templates</Button></Link>}
          {me.is_staff && <Link href="/inspections/bulk"><Button variant="secondary">Schedule from template</Button></Link>}
          <Link href="/inspections/new">
            <Button><Plus className="h-4 w-4" /> New inspection</Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {scheduled && <Alert tone="success" title={`${scheduled} inspection${scheduled === '1' ? '' : 's'} scheduled from the template`} />}
        {sp.marked && (
          <Alert tone="success" title={`${sp.marked} inspection${sp.marked === '1' ? '' : 's'} marked done`}>
            {sp.skipped ? `${sp.skipped} skipped because they were already completed or cancelled.` : null}
          </Alert>
        )}
        {sp.error && <Alert tone="danger" title="Could not mark inspections done">{sp.error}</Alert>}
        {rowsRes.error && <Alert tone="danger" title="Could not load every inspection">{rowsRes.error}</Alert>}
        {!itemsComplete && <Alert tone="warning" title="Flags and scores unavailable">{itemsRes.error ?? 'There are too many findings to load, so flags and scores are hidden rather than shown from a partial set.'}</Alert>}
        {rowsRes.truncated && <Alert tone="warning" title="List is incomplete">There are more inspections than this page can load. Filter by association or type.</Alert>}
        <MetricStrip metrics={metrics} />

        {/* ── TABS ── */}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {TABS.map((t) => {
            const active = t.key === tab;
            const params = new URLSearchParams();
            params.set('tab', t.key);
            if (q) params.set('q', q);
            return (
              <Link
                key={t.key}
                href={`/inspections?${params.toString()}`}
                className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-gray-950 text-gray-950'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
                <span
                  className={`ml-1.5 rounded-full px-1.5 text-xs tabular-nums ${
                    active ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {tabCounts[t.key]}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* ── FILTER BAR ── */}
        <FilterBar
          action="/inspections"
          searchDefault={q}
          searchPlaceholder="Search by type, association, unit, inspector..."
        >
          <input type="hidden" name="tab" value={tab} />

          <FilterSelect label="Status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </FilterSelect>

          <FilterSelect label="Type" name="type" defaultValue={type}>
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Association" name="association_id" defaultValue={association_id}>
            <option value="">All</option>
            {(associations ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </FilterSelect>
        </FilterBar>

        {/* ── TABLE ── */}
        {filtered.length > 0 ? (
          <form action={markInspectionsDone} className="space-y-3">
          <input type="hidden" name="return_to" value={`/inspections?${new URLSearchParams(Object.entries({ tab, q, status, type, association_id }).filter(([, v]) => v)).toString()}`} />
          <div className="flex items-center justify-end">
            <Button type="submit" variant="secondary" size="sm">Mark selected done</Button>
          </div>
          <Table>
            <THead>
              <TR>
                <TH className="w-10"><SelectAllCheckbox targetName="inspection_id" defaultChecked={false} /></TH>
                <TH>Type</TH>
                <TH>Association</TH>
                <TH>Unit</TH>
                <TH>Scheduled Date</TH>
                <TH>Inspector</TH>
                <TH>Status</TH>
                <TH className="text-right">Flags</TH>
                <TH className="text-right">Score</TH>
              </TR>
            </THead>
            <tbody>
              {filtered.map((insp: any) => {
                const sc = statusChip(insp.status);
                const sb = scoreBadge(insp.score);
                return (
                  <TR key={insp.id}>
                    <TD>
                      {['scheduled', 'in_progress'].includes(insp.status) && (
                        <input type="checkbox" name="inspection_id" value={insp.id} aria-label="Select inspection" className="h-4 w-4 rounded border-gray-300" />
                      )}
                    </TD>
                    <TD className="font-medium text-gray-900">
                      <Link href={`/inspections/${insp.id}`} className="block text-gray-900 hover:text-blue-700">
                        {insp.inspection_type ?? 'Untitled'}
                      </Link>
                    </TD>
                    <TD className="text-sm text-gray-700">{insp.associations?.name ?? '—'}</TD>
                    <TD className="text-sm text-gray-700">{insp.units?.unit_number ?? '—'}</TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{date(insp.scheduled_date)}</TD>
                    <TD className="text-sm text-gray-700">{insp.vendors?.name ?? '—'}</TD>
                    <TD>
                      <StatusChip tone={sc.tone}>{sc.label}</StatusChip>
                    </TD>
                    <TD className="text-right tabular-nums">
                      {insp.flags === null ? <span className="text-gray-400">—</span> : insp.flags > 0 ? <StatusChip tone="warning">{insp.flags}</StatusChip> : <span className="text-gray-400">0</span>}
                    </TD>
                    <TD className="text-right">
                      <StatusChip tone={sb.tone}>{sb.label}</StatusChip>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
          </form>
        ) : (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={ClipboardCheck}
              title="No inspections match this view"
              description="Scheduled and completed property inspections will appear here."
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
