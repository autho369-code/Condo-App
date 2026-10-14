import { fetchAllRows } from '@/lib/supabase/fetch-all';
import Link from 'next/link';
import { ClipboardCheck, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { mergePrivateFields } from '@/lib/private-fields';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button, buttonClass } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';
import { SelectAllCheckbox } from '@/components/ui/select-all';
import { markInspectionsDone } from '@/lib/rpcs/inspections-bulk';
import { todayInZone } from '@/lib/time/zoned';
import { displayTimeZone, isValidTimeZone } from '@/lib/time/display-zone';
import { inspectionSearchTerm, inspectionSearchOr } from '@/lib/inspections/list-query';

export const dynamic = 'force-dynamic';

// Inspections per page; the counts above the table cover every inspection.
const PAGE_SIZE = 100;
// Matches per related record kind (association, unit, inspector, notes) a search looks for.
const SEARCH_MATCH_LIMIT = 200;

// ── Types ──
type Tab = 'all' | 'scheduled' | 'in_progress' | 'completed';
type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'all',         label: 'All' },
  { key: 'scheduled',   label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed',   label: 'Completed' },
];
const STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'];

// ── Helpers ──
function parseTab(value: string | undefined): Tab {
  return (TABS.find((t) => t.key === value)?.key as Tab) ?? 'all';
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

// Scores: see inspection_item_scores (supabase/migrations/20261012050000).

// ── Page ──
export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; status?: string; type?: string; association_id?: string; page?: string; scheduled?: string; marked?: string; skipped?: string; error?: string }>;
}) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const sp = await searchParams;
  const { tab: tabParam, q = '', type = '', association_id = '', scheduled: scheduledRaw } = sp;
  const status = STATUSES.includes(sp.status ?? '') ? (sp.status as string) : '';
  const scheduled = scheduledRaw && /^\d+$/.test(scheduledRaw) && scheduledRaw !== '0' ? scheduledRaw : null;
  const tab = parseTab(tabParam);
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  // ── Search: the inspection type, or the ids of matching associations,
  // units, inspectors and (staff-only) notes — resolved in the database. ──
  const term = inspectionSearchTerm(q);
  let searchOr: string | null = null;
  let searchError: string | null = null;
  if (term) {
    const like = `%${term}%`;
    const [assocMatch, unitMatch, vendorMatch, notesMatch] = await Promise.all([
      db.from('associations').select('id').ilike('name', like).order('id').limit(SEARCH_MATCH_LIMIT),
      db.from('units').select('id').ilike('unit_number', like).order('id').limit(SEARCH_MATCH_LIMIT),
      db.from('vendors').select('id').ilike('name', like).order('id').limit(SEARCH_MATCH_LIMIT),
      db.from('inspection_private').select('inspection_id').ilike('notes', like).order('inspection_id').limit(SEARCH_MATCH_LIMIT),
    ]);
    searchError = assocMatch.error?.message ?? unitMatch.error?.message ?? vendorMatch.error?.message ?? notesMatch.error?.message ?? null;
    searchOr = inspectionSearchOr(term, {
      associationIds: (assocMatch.data ?? []).map((r: any) => r.id),
      unitIds: (unitMatch.data ?? []).map((r: any) => r.id),
      vendorIds: (vendorMatch.data ?? []).map((r: any) => r.id),
      inspectionIds: (notesMatch.data ?? []).map((r: any) => r.inspection_id),
    });
  }

  // Every list filter runs in the query.
  const listFilters = (query: any) => {
    let x = query.is('archived_at', null);
    if (tab !== 'all') x = x.eq('status', tab);
    if (status) x = x.eq('status', status);
    if (type) x = x.eq('inspection_type', type);
    if (association_id) x = x.eq('association_id', association_id);
    if (searchOr) x = x.or(searchOr);
    return x;
  };
  const headCount = (build: (query: any) => any) =>
    build(db.from('inspections').select('id', { count: 'exact', head: true }).is('archived_at', null));

  // ── Fetch one page + counts + reference lists ──
  const [
    listRes,
    totalRes,
    scheduledRes,
    inProgressRes,
    completedRes,
    { data: associations },
    itemsRes,
    archivedRes,
    typesRes,
  ] = await Promise.all([
    listFilters(db.from('inspections')
      .select('id, inspection_type, association_id, unit_id, scheduled_date, inspector_vendor_id, inspector_user_id, status, completed_date, created_at, associations(name), units(unit_number), vendors:inspector_vendor_id(name)', { count: 'exact' }))
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE_SIZE - 1),
    headCount((x) => x),
    headCount((x) => x.eq('status', 'scheduled')),
    headCount((x) => x.eq('status', 'in_progress')),
    headCount((x) => x.eq('status', 'completed')),
    db.from('associations').select('id, name, timezone').is('archived_at', null).order('name'),
    // Each inspection's score and open flags, computed in the database
    // (inspection_item_scores) instead of loading every finding.
    fetchAllRows<any>(() => db.rpc('inspection_item_scores').order('inspection_id')),
    // Archived inspections leave the average score.
    fetchAllRows<any>(() => db.from('inspections').select('id').not('archived_at', 'is', null).order('id')),
    // Type choices for the filter (one short column).
    fetchAllRows<any>(() => db.from('inspections').select('inspection_type').is('archived_at', null).not('inspection_type', 'is', null).order('id')),
  ]);

  const pageRows: any[] = listRes.data ?? [];
  const listError: string | null = listRes.error?.message ?? searchError;
  const matching: number = listRes.count ?? pageRows.length;
  const pageCount = Math.max(1, Math.ceil(matching / PAGE_SIZE));
  const totalCount: number = totalRes.count ?? 0;
  const scheduledCount: number = scheduledRes.count ?? 0;
  const inProgressCount: number = inProgressRes.count ?? 0;
  const completedCount: number = completedRes.count ?? 0;
  const countError = totalRes.error ?? scheduledRes.error ?? inProgressRes.error ?? completedRes.error;

  // Notes are staff-only (inspection_private); merged for the rows shown.
  await mergePrivateFields(db, 'inspection_private', 'inspection_id', ['notes'], pageRows);
  // Flags and scores are only shown when every inspection's summary loaded; a
  // partial set would show undercounts that look exact.
  const itemsComplete = !itemsRes.error && !itemsRes.truncated && !archivedRes.error && !archivedRes.truncated;
  const scoreByInspection = new Map<string, { score: number | null; flags: number }>(
    (itemsComplete ? itemsRes.rows : []).map((r: any) => [r.inspection_id, { score: r.score ?? null, flags: Number(r.flags ?? 0) }]),
  );
  const archivedIds = new Set<string>((archivedRes.rows ?? []).map((r: any) => r.id));

  // Flags: findings on the inspection that are not resolved yet.
  const shown = pageRows.map((row: any) => ({
    ...row,
    score: itemsComplete ? scoreByInspection.get(row.id)?.score ?? null : null,
    flags: itemsComplete ? scoreByInspection.get(row.id)?.flags ?? 0 : null,
  }));

  // ── Tab counts (every inspection, before the other filters) ──
  const tabCounts: Record<Tab, number> = {
    all: totalCount,
    scheduled: scheduledCount,
    in_progress: inProgressCount,
    completed: completedCount,
  };

  // ── Overdue: scheduled before today in each association's own time zone ──
  const zoneByAssociation = new Map<string, string>(
    ((associations ?? []) as any[]).filter((a) => a.timezone && isValidTimeZone(a.timezone)).map((a) => [a.id, a.timezone]),
  );
  const todayFor = (associationId: string | null) => todayInZone(zoneByAssociation.get(associationId ?? '') ?? displayTimeZone());
  const associationsByToday = new Map<string, string[]>();
  for (const a of (associations ?? []) as any[]) {
    const today = todayFor(a.id);
    associationsByToday.set(today, [...(associationsByToday.get(today) ?? []), a.id]);
  }
  const overdueParts: Array<Promise<{ count: number | null; error: any }>> = [];
  for (const [today, ids] of associationsByToday) {
    for (let i = 0; i < ids.length; i += 150) {
      const chunk = ids.slice(i, i + 150);
      // Date-only compare: an inspection scheduled today is not overdue.
      overdueParts.push(headCount((x) => x.eq('status', 'scheduled').lt('scheduled_date', today).in('association_id', chunk)));
    }
  }
  const overdueResults = await Promise.all(overdueParts);
  const overdueError = overdueResults.find((r) => r.error)?.error ?? null;
  const overdueCount = overdueResults.reduce((sum, r) => sum + (r.count ?? 0), 0);

  const avgScore = (() => {
    if (!itemsComplete) return null;
    const scores = itemsRes.rows.filter((r: any) => r.score !== null && r.score !== undefined && !archivedIds.has(r.inspection_id));
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((sum: number, r: any) => sum + Number(r.score), 0) / scores.length);
  })();

  const metrics = [
    { label: 'Scheduled', value: scheduledCount, sublabel: overdueError ? 'Overdue count unavailable' : `${overdueCount} overdue` },
    { label: 'In Progress', value: inProgressCount, sublabel: 'Active inspections' },
    { label: 'Completed', value: completedCount, sublabel: `${avgScore !== null ? `Avg score: ${avgScore}%` : 'No scores yet'}` },
    { label: 'Total', value: totalCount, sublabel: 'All inspections' },
  ];

  // ── Unique inspection types for filter ──
  const types = [...new Set((typesRes.rows ?? []).map((r: any) => r.inspection_type).filter(Boolean))].sort() as string[];

  const filterParams = Object.entries({ tab, q, status, type, association_id }).filter(([, v]) => v) as Array<[string, string]>;
  const pageHref = (n: number) => {
    const params = new URLSearchParams(filterParams);
    if (n > 1) params.set('page', String(n));
    return `/inspections?${params.toString()}`;
  };
  const returnParams = new URLSearchParams(filterParams);
  if (page > 1) returnParams.set('page', String(page));

  // ── Render ──
  return (
    <DataWorkspace
      title="Inspections"
      description="Schedule, track, and score property inspections across associations and units."
      actions={
        <div className="flex flex-wrap gap-2">
          {me.is_staff && <Link href="/inspections/templates" className={buttonClass('secondary')}>Templates</Link>}
          {me.is_staff && <Link href="/inspections/bulk" className={buttonClass('secondary')}>Schedule from template</Link>}
          <Link href="/inspections/new" className={buttonClass()}><Plus className="h-4 w-4" /> New inspection</Link>
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
        {listError && <Alert tone="danger" title="Could not load inspections">{listError}</Alert>}
        {countError && <Alert tone="danger" title="Could not count inspections">{countError.message}</Alert>}
        {!itemsComplete && <Alert tone="warning" title="Flags and scores unavailable">{itemsRes.error ?? archivedRes.error ?? 'Could not load the flags and scores, so they are hidden rather than shown from a partial set.'}</Alert>}
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
        {shown.length > 0 ? (
          <form action={markInspectionsDone} className="space-y-3">
          <input type="hidden" name="return_to" value={`/inspections?${returnParams.toString()}`} />
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
              {shown.map((insp: any) => {
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
          <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={ClipboardCheck}
              title="No inspections match this view"
              description="Scheduled and completed property inspections will appear here."
            />
          </div>
        )}

        {pageCount > 1 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Inspections {(from + 1).toLocaleString()}-{Math.min(from + PAGE_SIZE, matching).toLocaleString()} of {matching.toLocaleString()} matching. The counts above include every inspection.
            </p>
            <div className="flex gap-2">
              {page > 1 && <Link href={pageHref(page - 1)} className={buttonClass('secondary')}>Previous</Link>}
              {page < pageCount && <Link href={pageHref(page + 1)} className={buttonClass('secondary')}>Next</Link>}
            </div>
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
