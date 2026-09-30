import Link from 'next/link';
import { Plus, Wrench } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ExportActions, type ExportTable } from '@/components/export/export-actions';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/shell';
import { SelectAllCheckbox } from '@/components/ui/select-all';
import { bulkWorkOrderAction } from '@/lib/rpcs/work-order-bulk';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';
import { tradeLabel } from '@/lib/vendors/options';

export const dynamic = 'force-dynamic';

// ── Types ──
type Tab = 'open' | 'emergency' | 'scheduled' | 'unassigned' | 'completed' | 'all';
type Priority = 'low' | 'normal' | 'high' | 'emergency';
type WoStatus = 'new' | 'assigned' | 'scheduled' | 'in_progress' | 'done' | 'completed' | 'billed' | 'closed' | 'cancelled';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'open',       label: 'Open' },
  { key: 'emergency',  label: 'Emergencies' },
  { key: 'scheduled',  label: 'Scheduled' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'completed',  label: 'Completed' },
  { key: 'all',        label: 'All' },
];

const STATUSES: WoStatus[] = ['new', 'assigned', 'scheduled', 'in_progress', 'done', 'completed', 'billed', 'closed', 'cancelled'];
const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'emergency'];

// ── Helpers ──
function parseTab(value: string | undefined): Tab {
  return (TABS.find((t) => t.key === value)?.key as Tab) ?? 'open';
}

function tabFilter(tab: Tab): (r: any) => boolean {
  switch (tab) {
    case 'open':       return (r) => !['completed','closed','cancelled'].includes(r.status);
    case 'emergency':  return (r) => r.priority === 'emergency' && !['completed','closed','cancelled'].includes(r.status);
    case 'scheduled':  return (r) => r.status === 'scheduled';
    case 'unassigned': return (r) => !r.vendor_id && !['completed','closed','cancelled'].includes(r.status);
    case 'completed':  return (r) => r.status === 'completed' || r.status === 'closed';
    case 'all':        return () => true;
  }
}

function priorityBadge(p: Priority | string | null): { label: string; tone: Tone } {
  switch (p) {
    case 'emergency': return { label: 'Emergency', tone: 'danger' };
    case 'high':      return { label: 'High',     tone: 'warning' };
    case 'normal':    return { label: 'Normal',   tone: 'neutral' };
    case 'low':       return { label: 'Low',      tone: 'neutral' };
    default:          return { label: p ?? '—',   tone: 'neutral' };
  }
}

function statusChip(s: WoStatus | string | null): { label: string; tone: Tone } {
  switch (s) {
    case 'new':         return { label: 'Open',        tone: 'warning' };
    case 'assigned':    return { label: 'Assigned',    tone: 'info' };
    case 'scheduled':   return { label: 'Scheduled',   tone: 'info' };
    case 'in_progress': return { label: 'In Progress', tone: 'info' };
    case 'done':        return { label: 'Done',        tone: 'success' };
    case 'completed':   return { label: 'Completed',   tone: 'success' };
    case 'billed':      return { label: 'Billed',      tone: 'info' };
    case 'closed':      return { label: 'Closed',      tone: 'success' };
    case 'cancelled':   return { label: 'Cancelled',   tone: 'neutral' };
    default:            return { label: s?.replace(/_/g, ' ') ?? '—', tone: 'neutral' };
  }
}

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Page ──
export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; status?: string; priority?: string; association_id?: string; vendor_id?: string; bulk?: string; done?: string; failed?: string; reason?: string; nolog?: string; same?: string; error?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const { tab: tabParam, q = '', status = '', priority = '', association_id = '', vendor_id = '' } = sp;
  const tab = parseTab(tabParam);
  const todayDate = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const db = supabase as any;

  let workOrdersQuery = db.from('work_orders')
    .select('id, number, title, description, status, priority, scheduled_date, vendor_id, trade, association_id, unit_id, created_at, vendors(name, trade), units(unit_number), associations(name)')
    .is('archived_at', null);
  if (status === 'overdue') {
    workOrdersQuery = workOrdersQuery
      .lt('scheduled_date', todayDate)
      .not('status', 'in', '("done","completed","billed","closed","cancelled")');
  }
  workOrdersQuery = workOrdersQuery
    .order('priority', { ascending: false })
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500);
  const aggregateRowsQuery = status === 'overdue'
    ? db.from('work_orders')
        .select('id, status, priority, scheduled_date, vendor_id')
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(500)
    : Promise.resolve({ data: null });

  // ── Fetch work orders + reference lists ──
  const [
    { data: rows },
    { data: associations },
    { data: vendors },
    { data: aggregateRows },
  ] = await Promise.all([
    workOrdersQuery,
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('vendors').select('id, name').is('archived_at', null).order('name'),
    aggregateRowsQuery,
  ]);

  const all = (rows ?? []) as any[];
  const aggregateAll = status === 'overdue' ? ((aggregateRows ?? []) as any[]) : all;

  // ── Tab counts ──
  const tabCounts = Object.fromEntries(TABS.map((t) => [t.key, aggregateAll.filter(tabFilter(t.key)).length]));

  // ── Filter ──
  let filtered = all.filter(tabFilter(status === 'overdue' ? 'all' : tab));
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(
      (w: any) =>
        (w.title ?? '').toLowerCase().includes(ql) ||
        (w.description ?? '').toLowerCase().includes(ql) ||
        (w.number ?? '').toLowerCase().includes(ql) ||
        String(w.id).toLowerCase().includes(ql) ||
        (w.vendors?.name ?? '').toLowerCase().includes(ql) ||
        (w.associations?.name ?? '').toLowerCase().includes(ql) ||
        (w.units?.unit_number ?? '').toLowerCase().includes(ql),
    );
  }
  if (status === 'overdue') {
    filtered = filtered.filter((w: any) => (
      w.scheduled_date
      && w.scheduled_date < todayDate
      && !['done', 'completed', 'billed', 'closed', 'cancelled'].includes(w.status)
    ));
  } else if (status) {
    filtered = filtered.filter((w: any) => w.status === status);
  }
  if (priority) filtered = filtered.filter((w: any) => w.priority === priority);
  if (association_id) filtered = filtered.filter((w: any) => w.association_id === association_id);
  if (vendor_id) filtered = filtered.filter((w: any) => w.vendor_id === vendor_id);

  // ── Metrics ──
  const openCount = aggregateAll.filter((w: any) => !['completed','closed','cancelled'].includes(w.status)).length;
  const inProgressCount = aggregateAll.filter((w: any) => w.status === 'in_progress').length;
  const overdueCount = aggregateAll.filter(
    (w: any) => w.scheduled_date && w.scheduled_date < todayDate && !['done','completed','billed','closed','cancelled'].includes(w.status),
  ).length;
  const completedMonthCount = aggregateAll.filter(
    (w: any) => (w.status === 'completed' || w.status === 'closed'),
  ).length; // simplified

  const metrics = [
    { label: 'Open', value: openCount, sublabel: `${tabCounts['emergency']} emergencies` },
    { label: 'In Progress', value: inProgressCount, sublabel: 'Active work' },
    { label: 'Overdue', value: overdueCount, sublabel: 'Past scheduled date' },
    { label: 'Completed this month', value: completedMonthCount, sublabel: 'All time' },
  ];

  // ── Export (mirrors the on-screen table, same tab + filters) ──
  const companyName = me.portfolio?.company_name ?? 'Management company';
  const exportStamp = new Date().toISOString().slice(0, 10);
  const exportTable: ExportTable = {
    columns: [
      { header: '#' },
      { header: 'Description' },
      { header: 'Association' },
      { header: 'Unit' },
      { header: 'Status' },
      { header: 'Priority' },
      { header: 'Vendor' },
      { header: 'Scheduled' },
    ],
    rows: filtered.map((w: any) => [
      w.number ?? w.id.slice(0, 8),
      w.trade
        ? `${w.title ?? w.description ?? 'Untitled'} (${formatLabel(w.trade)})`
        : (w.title ?? w.description ?? 'Untitled'),
      w.associations?.name ?? '—',
      w.units?.unit_number ?? '—',
      statusChip(w.status).label,
      priorityBadge(w.priority).label,
      w.vendors?.name ?? 'Unassigned',
      date(w.scheduled_date),
    ]),
  };

  // Bulk actions return to exactly this view.
  const viewParams = new URLSearchParams();
  for (const [k, v] of Object.entries({ tab: status === 'overdue' ? 'all' : tab, q, status, priority, association_id, vendor_id })) if (v) viewParams.set(k, v);
  const backHref = `/work-orders?${viewParams.toString()}`;
  const BULK_LABEL: Record<string, string> = { assign: 'assigned', status: 'updated', priority: 'reprioritized' };

  // ── Render ──
  return (
    <DataWorkspace
      title="Work Orders"
      description="Track, dispatch, and manage maintenance work orders across associations and units."
      actions={
        <>
          <ExportActions
            documentTitle="Work Orders"
            companyName={companyName}
            filename={`work-orders-${tab}-${exportStamp}`}
            tables={[exportTable]}
          />
          <Link href="/work-orders/new">
            <Button><Plus className="h-4 w-4" /> New work order</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        {/* ── TABS ── */}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {TABS.map((t) => {
            const active = status !== 'overdue' && t.key === tab;
            const params = new URLSearchParams();
            params.set('tab', t.key);
            if (q) params.set('q', q);
            return (
              <Link
                key={t.key}
                href={`/work-orders?${params.toString()}`}
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
          action="/work-orders"
          searchDefault={q}
          searchPlaceholder="Search by number, title, vendor, unit..."
        >
          <input type="hidden" name="tab" value={status === 'overdue' ? 'all' : tab} />

          <FilterSelect label="Status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            <option value="overdue">Overdue</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{formatLabel(s)}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Priority" name="priority" defaultValue={priority}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{formatLabel(p)}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Association" name="association_id" defaultValue={association_id}>
            <option value="">All</option>
            {(associations ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Vendor" name="vendor_id" defaultValue={vendor_id}>
            <option value="">All</option>
            {(vendors ?? []).map((v: any) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </FilterSelect>
        </FilterBar>

        {sp.bulk && (
          <Alert tone={sp.failed ? 'danger' : 'success'} title={`${sp.done ?? 0} work order${sp.done === '1' ? '' : 's'} ${BULK_LABEL[sp.bulk] ?? 'updated'}${sp.failed ? ` · ${sp.failed} could not be` : ''}`}>
            {sp.same ? `${sp.same} already had that ${sp.bulk === 'assign' ? 'vendor' : sp.bulk} and were left unchanged. ` : null}
            {sp.reason}
            {sp.nolog ? `${sp.reason ? ' ' : ''}${sp.nolog} updated work order${sp.nolog === '1' ? '' : 's'} could not get an activity-log entry — the change itself was saved; don't repeat it.` : null}
          </Alert>
        )}
        {sp.error && <Alert tone="danger" title="Could not update work orders">{sp.error}</Alert>}

        {/* ── TABLE ── */}
        {filtered.length > 0 ? (
          <form action={bulkWorkOrderAction} className="space-y-3">
          <input type="hidden" name="back" value={backHref} />
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/70 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:flex-row lg:items-end lg:justify-between">
            <p className="text-sm text-gray-600">Select work orders (up to 200 at a time), then act on all of them at once.</p>
            <div className="flex flex-wrap items-end gap-2">
              <select name="vendor_id" aria-label="Vendor to assign" defaultValue=""
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                <option value="">Vendor…</option>
                {(vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <Button type="submit" name="op" value="assign" size="sm" variant="secondary">Assign</Button>
              <select name="status" aria-label="New status" defaultValue=""
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                <option value="">Status…</option>
                {STATUSES.map((s) => <option key={s} value={s}>{formatLabel(s)}</option>)}
              </select>
              <Button type="submit" name="op" value="status" size="sm" variant="secondary">Set status</Button>
              <select name="priority" aria-label="New priority" defaultValue=""
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                <option value="">Priority…</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{formatLabel(p)}</option>)}
              </select>
              <Button type="submit" name="op" value="priority" size="sm" variant="secondary">Set priority</Button>
            </div>
          </div>
          <Table>
            <THead>
              <TR>
                <TH className="w-10"><SelectAllCheckbox targetName="work_order_id" defaultChecked={false} max={200} /></TH>
                <TH>#</TH>
                <TH>Description</TH>
                <TH>Association</TH>
                <TH>Unit</TH>
                <TH>Status</TH>
                <TH>Priority</TH>
                <TH>Vendor</TH>
                <TH>Scheduled</TH>
              </TR>
            </THead>
            <tbody>
              {filtered.map((w: any) => {
                const sc = statusChip(w.status);
                const pb = priorityBadge(w.priority);
                return (
                  <TR key={w.id}>
                    <TD>
                      <input type="checkbox" name="work_order_id" value={w.id} aria-label={`Select work order ${w.number ?? w.title ?? ''}`} className="h-4 w-4 rounded border-gray-300" />
                    </TD>
                    <TD className="font-mono text-xs">
                      <Link href={`/work-orders/${w.id}`} className="text-gray-700 hover:text-gray-950 hover:underline">
                        {w.number ?? w.id.slice(0, 8)}
                      </Link>
                    </TD>
                    <TD className="max-w-xs">
                      <Link href={`/work-orders/${w.id}`} className="font-medium text-gray-900 hover:underline">
                        {w.title ?? w.description ?? 'Untitled'}
                      </Link>
                      {w.trade && (
                        <div className="text-xs text-gray-500">{tradeLabel(w.trade)}</div>
                      )}
                    </TD>
                    <TD className="text-sm text-gray-700">{w.associations?.name ?? '—'}</TD>
                    <TD className="text-sm text-gray-700">{w.units?.unit_number ?? '—'}</TD>
                    <TD>
                      <StatusChip tone={sc.tone}>{sc.label}</StatusChip>
                    </TD>
                    <TD>
                      <StatusChip tone={pb.tone}>{pb.label}</StatusChip>
                    </TD>
                    <TD>
                      {w.vendors?.name ? (
                        <Link href={`/vendors/${w.vendor_id}`} className="text-gray-700 hover:text-gray-950 hover:underline">
                          {w.vendors.name}
                        </Link>
                      ) : (
                        <StatusChip tone="danger">Unassigned</StatusChip>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{date(w.scheduled_date)}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
          </form>
        ) : (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={Wrench}
              title="No work orders match this view"
              description="Adjust the filters or create a new work order to get started."
              action={
                <Link href="/work-orders/new">
                  <Button><Plus className="h-4 w-4" /> New work order</Button>
                </Link>
              }
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
