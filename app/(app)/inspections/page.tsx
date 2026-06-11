import Link from 'next/link';
import { ClipboardCheck, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

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
  searchParams: Promise<{ tab?: string; q?: string; status?: string; type?: string; association_id?: string }>;
}) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const { tab: tabParam, q = '', status = '', type = '', association_id = '' } = await searchParams;
  const tab = parseTab(tabParam);

  // ── Fetch inspections + reference lists ──
  const [
    { data: rows },
    { data: associations },
    { data: items },
  ] = await Promise.all([
    db.from('inspections')
      .select('id, inspection_type, association_id, unit_id, scheduled_date, inspector_vendor_id, inspector_user_id, status, notes, completed_date, created_at, associations(name), units(unit_number), vendors:inspector_vendor_id(name)')
      .is('archived_at', null)
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('inspection_items').select('id, inspection_id, severity').order('created_at'),
  ]);

  const all = (rows ?? []) as any[];

  // ── Build score map from inspection_items ──
  const itemsByInspection = new Map<string, any[]>();
  for (const item of (items ?? [])) {
    const list = itemsByInspection.get(item.inspection_id) ?? [];
    list.push(item);
    itemsByInspection.set(item.inspection_id, list);
  }

  // Attach score to each inspection row
  const scored = all.map((row: any) => ({
    ...row,
    score: computeScore(itemsByInspection.get(row.id) ?? []),
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
  const now = new Date();
  const overdueCount = scored.filter(
    (insp: any) => insp.scheduled_date && new Date(insp.scheduled_date) < now && insp.status === 'scheduled',
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
        <Link href="/inspections/new">
          <Button><Plus className="h-4 w-4" /> New inspection</Button>
        </Link>
      }
    >
      <div className="space-y-6">
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
          <Table>
            <THead>
              <TR>
                <TH>Type</TH>
                <TH>Association</TH>
                <TH>Unit</TH>
                <TH>Scheduled Date</TH>
                <TH>Inspector</TH>
                <TH>Status</TH>
                <TH className="text-right">Score</TH>
              </TR>
            </THead>
            <tbody>
              {filtered.map((insp: any) => {
                const sc = statusChip(insp.status);
                const sb = scoreBadge(insp.score);
                return (
                  <TR key={insp.id}>
                    <TD className="font-medium text-gray-900">
                      {insp.inspection_type ?? 'Untitled'}
                    </TD>
                    <TD className="text-sm text-gray-700">{insp.associations?.name ?? '—'}</TD>
                    <TD className="text-sm text-gray-700">{insp.units?.unit_number ?? '—'}</TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{date(insp.scheduled_date)}</TD>
                    <TD className="text-sm text-gray-700">{insp.vendors?.name ?? '—'}</TD>
                    <TD>
                      <StatusChip tone={sc.tone}>{sc.label}</StatusChip>
                    </TD>
                    <TD className="text-right">
                      <StatusChip tone={sb.tone}>{sb.label}</StatusChip>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
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
