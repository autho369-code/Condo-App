import Link from 'next/link';
import { Plus, Users, Wrench } from 'lucide-react';
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
import { tradeLabel, vendorAssociationLabel } from '@/lib/vendors/options';
import { todayInZone } from '@/lib/time/zoned';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { sanitizeSearchTerm } from '@/lib/search/global';

export const dynamic = 'force-dynamic';

// ── Types ──
type Tab = 'open' | 'emergency' | 'scheduled' | 'unassigned' | 'ready_to_bill' | 'completed' | 'all';
type Priority = 'low' | 'normal' | 'high' | 'emergency';
type WoStatus = 'new' | 'assigned' | 'scheduled' | 'in_progress' | 'done' | 'completed' | 'billed' | 'closed' | 'cancelled';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'open',       label: 'Open' },
  { key: 'emergency',  label: 'Emergencies' },
  { key: 'scheduled',  label: 'Scheduled' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'ready_to_bill', label: 'Ready to bill' },
  { key: 'completed',  label: 'Completed' },
  { key: 'all',        label: 'All' },
];

const STATUSES: WoStatus[] = ['new', 'assigned', 'scheduled', 'in_progress', 'done', 'completed', 'billed', 'closed', 'cancelled'];
const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'emergency'];

// ── Helpers ──
// work_order_status values that mean the job is finished.
const FINISHED_WO = ['done', 'completed', 'billed', 'closed', 'cancelled'];

function parseTab(value: string | undefined): Tab {
  return (TABS.find((t) => t.key === value)?.key as Tab) ?? 'open';
}

function tabFilter(tab: Tab): (r: any) => boolean {
  switch (tab) {
    case 'open':       return (r) => !FINISHED_WO.includes(r.status);
    case 'emergency':  return (r) => r.priority === 'emergency' && !FINISHED_WO.includes(r.status);
    case 'scheduled':  return (r) => r.status === 'scheduled';
    // Same finished set as the team scoreboard's "nobody on it" count.
    case 'unassigned': return (r) => !r.vendor_id && !r.assignee_id && !['done','completed','billed','closed','cancelled'].includes(r.status);
    case 'ready_to_bill': return (r) => ['done', 'completed'].includes(r.status);
    case 'completed':  return (r) => ['done', 'completed', 'billed', 'closed'].includes(r.status);
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
  searchParams: Promise<{ tab?: string; q?: string; status?: string; priority?: string; association_id?: string; vendor_id?: string; assignee?: string; bulk?: string; done?: string; failed?: string; reason?: string; error?: string; origin?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const { tab: tabParam, q = '', status = '', priority = '', association_id = '', vendor_id = '' } = sp;
  // In-house assignee filter: a staff id, or "me".
  const assignee = sp.assignee === 'me' ? (me.auth_user_id ?? '') : (sp.assignee ?? '');
  const tab = parseTab(tabParam);
  // Unassigned split the way AppFolio counts it: from a resident request, or internal.
  const origin = sp.origin === 'resident' || sp.origin === 'internal' ? sp.origin : '';
  const todayDate = todayInZone();
  const supabase = await createClient();
  const db = supabase as any;

  const FINISHED = '("done","completed","billed","closed","cancelled")';
  // Count queries share the assignee filter; counts are exact (no row cap).
  const countBase = () => {
    let q = db.from('work_orders').select('id', { count: 'exact', head: true }).is('archived_at', null);
    if (assignee) q = q.eq('assignee_id', assignee);
    return q;
  };
  const applyTab = (q: any, t: Tab) => {
    switch (t) {
      case 'open':       return q.not('status', 'in', FINISHED);
      case 'emergency':  return q.eq('priority', 'emergency').not('status', 'in', FINISHED);
      case 'scheduled':  return q.eq('status', 'scheduled');
      case 'unassigned': return q.is('vendor_id', null).is('assignee_id', null).not('status', 'in', FINISHED);
      // Finished but not yet billed.
      case 'ready_to_bill': return q.in('status', ['done', 'completed']);
      case 'completed':  return q.in('status', ['done', 'completed', 'billed', 'closed']);
      case 'all':        return q;
    }
  };
  const applyOrigin = (q: any, o: string) =>
    o === 'resident' ? q.not('service_request_id', 'is', null) : o === 'internal' ? q.is('service_request_id', null) : q;

  // Search runs in the database (title, description, number, and vendor,
  // association or unit names), so it covers every work order, not just the
  // first 500 loaded.
  const term = sanitizeSearchTerm(q);
  const quoted = (v: string) => `"${v.replace(/"/g, '')}"`;
  let searchClauses: string[] | null = null;
  if (term) {
    const [{ rows: vMatch }, { rows: aMatch }, { rows: uMatch }] = await Promise.all([
      fetchAllRows<any>(() => db.from('vendors').select('id').ilike('name', `%${term}%`).order('id')),
      fetchAllRows<any>(() => db.from('associations').select('id').ilike('name', `%${term}%`).order('id')),
      fetchAllRows<any>(() => db.from('units').select('id').ilike('unit_number', `%${term}%`).order('id')),
    ]);
    searchClauses = [
      `title.ilike.${quoted(`*${term}*`)}`,
      `description.ilike.${quoted(`*${term}*`)}`,
      `number.ilike.${quoted(`*${term}*`)}`,
    ];
    if (/^[0-9a-f-]{36}$/i.test(term)) searchClauses.push(`id.eq.${term}`);
    if (vMatch.length) searchClauses.push(`vendor_id.in.(${vMatch.map((r: any) => r.id).join(',')})`);
    if (aMatch.length) searchClauses.push(`association_id.in.(${aMatch.map((r: any) => r.id).join(',')})`);
    if (uMatch.length) searchClauses.push(`unit_id.in.(${uMatch.map((r: any) => r.id).join(',')})`);
  }

  // The list applies every filter in the query, so its 500 rows are the
  // matching ones (filtering 500 fetched rows afterwards hid older jobs).
  let workOrdersQuery = db.from('work_orders')
    .select('id, number, title, description, status, priority, scheduled_date, vendor_id, assignee_id, assigned_to, trade, association_id, unit_id, created_at, vendors(name, trade), units(unit_number), associations(name)')
    .is('archived_at', null);
  if (assignee) workOrdersQuery = workOrdersQuery.eq('assignee_id', assignee);
  if (status === 'overdue') {
    workOrdersQuery = workOrdersQuery.lt('scheduled_date', todayDate).not('status', 'in', FINISHED);
  } else {
    workOrdersQuery = applyTab(workOrdersQuery, tab);
    if (tab === 'unassigned') workOrdersQuery = applyOrigin(workOrdersQuery, origin);
    if (status) workOrdersQuery = workOrdersQuery.eq('status', status);
  }
  if (searchClauses) workOrdersQuery = workOrdersQuery.or(searchClauses.join(','));
  if (priority) workOrdersQuery = workOrdersQuery.eq('priority', priority);
  if (association_id) workOrdersQuery = workOrdersQuery.eq('association_id', association_id);
  if (vendor_id) workOrdersQuery = workOrdersQuery.eq('vendor_id', vendor_id);
  workOrdersQuery = workOrdersQuery
    .order('priority', { ascending: false })
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500);

  // ── Fetch work orders, counts and reference lists ──
  const [
    { data: rows, error: listError },
    { data: associations },
    { data: vendors },
    { data: staff },
    tabCountResults,
    { count: inProgressCount },
    { count: overdueCount },
    { count: unassignedResidentCount },
    { count: unassignedInternalCount },
  ] = await Promise.all([
    workOrdersQuery,
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    fetchAllRows<any>(() => db.from('vendors').select('id, name, is_management_company, associations(name)').is('archived_at', null).order('name').order('id')).then((r) => ({ data: r.rows })),
    db.rpc('mentionable_staff'),
    Promise.all(TABS.map((t) => applyTab(countBase(), t.key))),
    countBase().eq('status', 'in_progress'),
    countBase().lt('scheduled_date', todayDate).not('status', 'in', FINISHED),
    applyOrigin(applyTab(countBase(), 'unassigned'), 'resident'),
    applyOrigin(applyTab(countBase(), 'unassigned'), 'internal'),
  ]);

  const all = (rows ?? []) as any[];

  // ── Tab counts ──
  const tabCounts = Object.fromEntries(TABS.map((t, i) => [t.key, Number(tabCountResults[i]?.count ?? 0)]));

  const filtered = all;
  const listCapped = all.length >= 500;

  // ── Metrics ──
  const openCount = tabCounts['open'];

  const metricLink = (href: string, label: string) => (
    <Link href={href} className="font-medium text-gray-500 transition-colors hover:text-gray-900">{label}</Link>
  );
  const metrics = [
    { label: 'Unassigned resident requests', value: unassignedResidentCount ?? 0, sublabel: metricLink('/work-orders?tab=unassigned&origin=resident', 'View') },
    { label: 'Unassigned internal', value: unassignedInternalCount ?? 0, sublabel: metricLink('/work-orders?tab=unassigned&origin=internal', 'View') },
    { label: 'Ready to bill', value: tabCounts['ready_to_bill'], sublabel: metricLink('/work-orders?tab=ready_to_bill', 'View') },
    { label: 'Open', value: openCount, sublabel: `${tabCounts['emergency']} emergencies · ${inProgressCount ?? 0} in progress` },
    { label: 'Overdue', value: overdueCount ?? 0, sublabel: 'Past scheduled date' },
  ];

  // ── Export (mirrors the on-screen table, same tab + filters) ──
  const companyName = me.portfolio?.company_name ?? 'Management company';
  const exportStamp = todayInZone();
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
  for (const [k, v] of Object.entries({ tab: status === 'overdue' ? 'all' : tab, q, status, priority, association_id, vendor_id, assignee: sp.assignee ?? '' })) if (v) viewParams.set(k, v);
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
          <Link href="/recurring-work-orders/new">
            <Button variant="secondary">New recurring work order</Button>
          </Link>
          <Link href="/purchase-orders/new">
            <Button variant="secondary">New purchase order</Button>
          </Link>
          <Link href="/work-orders/team">
            <Button variant="secondary"><Users className="h-4 w-4" /> Team</Button>
          </Link>
          <Link href="/work-orders/new">
            <Button><Plus className="h-4 w-4" /> New work order</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400">Reports</span>
          <Link href="/reports/work_order_report" className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-50">Association work orders</Link>
          <Link href="/reports/work_order_labor_summary" className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-50">Labor summary</Link>
          <Link href="/reports/work_order_bill_detail" className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-50">Billable detail</Link>
        </div>

        {tab === 'unassigned' && origin && (
          <Alert tone="info" title={origin === 'resident' ? 'Unassigned work orders from resident requests' : 'Unassigned internal work orders'}>
            <Link href="/work-orders?tab=unassigned" className="font-medium underline">Show all unassigned</Link>
          </Alert>
        )}
        {listCapped && (
          <Alert tone="warning" title="Showing the first 500 matches">Narrow the list with search, status, association or vendor to see the rest.</Alert>
        )}

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
          {tab === 'unassigned' && origin && <input type="hidden" name="origin" value={origin} />}

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

          <FilterSelect label="In-house" name="assignee" defaultValue={sp.assignee ?? ''}>
            <option value="">Anyone</option>
            <option value="me">Assigned to me</option>
            {(staff ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </FilterSelect>

          <FilterSelect label="Vendor" name="vendor_id" defaultValue={vendor_id}>
            <option value="">All</option>
            {(vendors ?? []).map((v: any) => (
              <option key={v.id} value={v.id}>{v.name} · {vendorAssociationLabel(v)}</option>
            ))}
          </FilterSelect>
        </FilterBar>

        {sp.bulk && (
          <Alert tone={sp.failed ? 'danger' : 'success'} title={`${sp.done ?? 0} work order${sp.done === '1' ? '' : 's'} ${BULK_LABEL[sp.bulk] ?? 'updated'}${sp.failed ? ` · ${sp.failed} could not be` : ''}`}>
            {sp.reason}
          </Alert>
        )}
        {sp.error && <Alert tone="danger" title="Could not update work orders">{sp.error}</Alert>}
        {listError && <Alert tone="danger" title="Work orders could not be loaded">{listError.message}</Alert>}

        {/* ── TABLE ── */}
        {filtered.length > 0 ? (
          <form action={bulkWorkOrderAction} className="space-y-3">
          <input type="hidden" name="back" value={backHref} />
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:flex-row lg:items-end lg:justify-between">
            <p className="text-sm text-gray-600">Select work orders, then act on all of them at once.</p>
            <div className="flex flex-wrap items-end gap-2">
              <select name="vendor_id" aria-label="Vendor to assign" defaultValue=""
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                <option value="">Vendor…</option>
                {(vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name} · {vendorAssociationLabel(v)}</option>)}
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
                <TH className="w-10"><SelectAllCheckbox targetName="work_order_id" defaultChecked={false} /></TH>
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
                        <div className="text-[13px] text-gray-500">{tradeLabel(w.trade)}</div>
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
                      ) : !w.assignee_id ? (
                        <StatusChip tone="danger">Unassigned</StatusChip>
                      ) : null}
                      {w.assignee_id ? <div className="text-[13px] text-gray-500">In-house: {w.assigned_to ?? 'team member'}</div> : null}
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{date(w.scheduled_date)}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
          </form>
        ) : (
          <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
