import Link from 'next/link';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { Alert, EmptyState } from '@/components/ui/shell';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { sanitizeSearchTerm } from '@/lib/search/global';
import { zonedWallTimeToUtc } from '@/lib/time/zoned';
import { displayTimeZone } from '@/lib/time/display-zone';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { date, money } from '@/lib/utils';
import { ApprovalStatusChip, OrderStatusChip } from './status-chips';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'pending_approval', label: 'Awaiting board' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string; q?: string; association_id?: string; vendor_id?: string; gl_account_id?: string;
    date_from?: string; date_to?: string; submitted?: string; completed?: string;
  }>;
}) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const { status: statusParam, q = '' } = sp;
  const filter = FILTERS.some((f) => f.value === statusParam) ? statusParam! : 'all';
  const uuid = (v?: string) => (v && UUID_RE.test(v) ? v : '');
  // A real calendar date only (2026-99-99 is ignored, not a 500).
  const ymd = (v?: string) => {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : '';
  };
  const associationId = uuid(sp.association_id);
  const vendorId = uuid(sp.vendor_id);
  const glAccountId = uuid(sp.gl_account_id);
  const dateFrom = ymd(sp.date_from);
  const dateTo = ymd(sp.date_to);
  const submitted = sp.submitted === 'yes' || sp.submitted === 'no' ? sp.submitted : '';
  const completed = sp.completed === 'yes' || sp.completed === 'no' ? sp.completed : '';
  const supabase = await createClient();
  const db = supabase as any;
  const zone = displayTimeZone();

  // Search runs in the database: PO number, or any vendor or association
  // whose name matches.
  const term = sanitizeSearchTerm(q);
  let searchClauses: string[] | null = null;
  if (term) {
    const [{ rows: vMatch }, { rows: aMatch }] = await Promise.all([
      fetchAllRows<any>(() => db.from('vendors').select('id').ilike('name', `%${term}%`).order('id')),
      fetchAllRows<any>(() => db.from('associations').select('id').ilike('name', `%${term}%`).order('id')),
    ]);
    searchClauses = [`number.ilike."*${term}*"`];
    if (vMatch.length) searchClauses.push(`vendor_id.in.(${vMatch.map((r: any) => r.id).join(',')})`);
    if (aMatch.length) searchClauses.push(`association_id.in.(${aMatch.map((r: any) => r.id).join(',')})`);
  }
  const fromIso = dateFrom ? zonedWallTimeToUtc(dateFrom, '00:00', zone)?.toISOString() ?? null : null;
  const toIso = (() => {
    if (!dateTo) return null;
    const [y, m, d] = dateTo.split('-').map(Number);
    const nextDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    return zonedWallTimeToUtc(nextDay, '00:00', zone)?.toISOString() ?? null;
  })();

  // Every filter except the approval tab, applied in the query.
  const filtered = (columns: string) => {
    let query = db.from('purchase_orders')
      .select(`${columns}${glAccountId ? ', purchase_order_line_items!inner(gl_account_id)' : ''}`)
      .is('archived_at', null);
    if (associationId) query = query.eq('association_id', associationId);
    if (vendorId) query = query.eq('vendor_id', vendorId);
    if (glAccountId) query = query.eq('purchase_order_line_items.gl_account_id', glAccountId);
    // PO date range, read as local calendar days.
    if (fromIso) query = query.gte('created_at', fromIso);
    if (toIso) query = query.lt('created_at', toIso);
    if (submitted === 'yes') query = query.not('submitted_at', 'is', null);
    if (submitted === 'no') query = query.is('submitted_at', null);
    // Completed: fully billed.
    if (completed === 'yes') query = query.eq('status', 'billed');
    if (completed === 'no') query = query.neq('status', 'billed');
    if (searchClauses) query = query.or(searchClauses.join(','));
    return query;
  };
  // The approval tab, also in the query, so older matches are never cut off.
  const withTab = (query: any) => {
    if (filter === 'all') return query;
    if (filter === 'cancelled') return query.eq('status', 'cancelled');
    return query.neq('status', 'cancelled').eq('approval_status', filter);
  };

  const [rowsRes, metricsRes, { data: associations }, { rows: vendors }, { data: glAccounts }] = await Promise.all([
    fetchAllRows<any>(() => withTab(filtered('id, number, status, approval_status, approval_required, po_total, po_billed, needed_by, submitted_at, created_at, vendors(name), associations(name)'))
      .order('created_at', { ascending: false }).order('id')),
    // Metrics cover every tab under the same filters.
    fetchAllRows<any>(() => filtered('id, status, approval_status, po_total, po_billed').order('id')),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    fetchAllRows<any>(() => db.from('vendors').select('id, name').is('archived_at', null).order('name').order('id')),
    db.from('gl_accounts').select('id, number, name').eq('active', true).order('number'),
  ]);
  const rows = rowsRes.rows;
  const pos = metricsRes.rows;
  const loadError = rowsRes.error ?? metricsRes.error;
  const incomplete = rowsRes.truncated || metricsRes.truncated;

  const live = pos.filter((po) => po.status !== 'cancelled');
  const sum = (list: any[], pick: (po: any) => number) => list.reduce((s, po) => s + pick(po), 0);
  const drafts = live.filter((po) => po.approval_status === 'draft');
  const awaiting = live.filter((po) => po.approval_status === 'pending_approval');
  const approved = live.filter((po) => po.approval_status === 'approved');
  const committed = sum(approved, (po) => Math.max(0, Number(po.po_total ?? 0) - Number(po.po_billed ?? 0)));

  const metrics: Metric[] = [
    { label: 'Awaiting board vote', value: awaiting.length, sublabel: money(sum(awaiting, (po) => Number(po.po_total ?? 0))) },
    { label: 'Drafts', value: drafts.length },
    { label: 'Approved', value: approved.length, sublabel: `${money(committed)} committed, unbilled` },
    { label: 'Billed to date', value: money(sum(live, (po) => Number(po.po_billed ?? 0))) },
  ];

  const hrefFor = (value: string) => {
    const params = new URLSearchParams();
    if (value !== 'all') params.set('status', value);
    if (q) params.set('q', q);
    for (const [key, value] of Object.entries({
      association_id: associationId, vendor_id: vendorId, gl_account_id: glAccountId,
      date_from: dateFrom, date_to: dateTo, submitted, completed,
    })) if (value) params.set(key, value);
    const s = params.toString();
    return s ? `/purchase-orders?${s}` : '/purchase-orders';
  };

  return (
    <DataWorkspace
      title="Purchase Orders"
      description="Commit spend before work starts. Orders over an association's threshold go to its board for a vote."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/purchase-orders/recurring"><Button variant="secondary">Recurring POs</Button></Link>
          <Link href="/purchase-orders/new">
            <Button><Plus className="h-4 w-4" /> New PO</Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {loadError && <Alert tone="danger" title="Could not load every purchase order">{loadError}</Alert>}
        {incomplete && <Alert tone="warning" title="List is incomplete">There are more purchase orders than this page can load. Narrow the filters.</Alert>}
        <MetricStrip metrics={metrics} />

        <nav className="flex flex-wrap gap-1" aria-label="Filter by approval status">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={hrefFor(f.value)}
              className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition ${
                filter === f.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </nav>

        <FilterBar action="/purchase-orders" searchDefault={q} searchPlaceholder="Search PO #, vendor, association...">
          {filter !== 'all' && <input type="hidden" name="status" value={filter} />}
          <FilterSelect label="Association" name="association_id" defaultValue={associationId}>
            <option value="">All associations</option>
            {((associations ?? []) as any[]).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Vendor" name="vendor_id" defaultValue={vendorId}>
            <option value="">All vendors</option>
            {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </FilterSelect>
          <FilterSelect label="GL account" name="gl_account_id" defaultValue={glAccountId}>
            <option value="">All GL accounts</option>
            {((glAccounts ?? []) as any[]).map((g) => <option key={g.id} value={g.id}>{g.number ? `${g.number} ` : ''}{g.name}</option>)}
          </FilterSelect>
          <label className="text-[12px] font-medium text-gray-500">
            From
            <input type="date" name="date_from" defaultValue={dateFrom} className="mt-1 block h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </label>
          <label className="text-[12px] font-medium text-gray-500">
            To
            <input type="date" name="date_to" defaultValue={dateTo} className="mt-1 block h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </label>
          <FilterSelect label="Submitted" name="submitted" defaultValue={submitted}>
            <option value="">Any</option>
            <option value="yes">Submitted</option>
            <option value="no">Not submitted</option>
          </FilterSelect>
          <FilterSelect label="Completed" name="completed" defaultValue={completed}>
            <option value="">Any</option>
            <option value="yes">Completed (billed)</option>
            <option value="no">Not completed</option>
          </FilterSelect>
        </FilterBar>

        {rows.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>PO #</TH>
                <TH>Vendor</TH>
                <TH>Association</TH>
                <TH>Status</TH>
                <TH>Needed by</TH>
                <TH className="text-right">Total</TH>
                <TH className="text-right">Billed</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((po) => (
                <TR key={po.id}>
                  <TD className="font-mono text-xs font-medium text-gray-900">
                    <Link href={`/purchase-orders/${po.id}`} className="hover:text-gray-600">{po.number ?? po.id.slice(0, 8)}</Link>
                  </TD>
                  <TD className="font-medium text-gray-900">
                    <Link href={`/purchase-orders/${po.id}`} className="hover:text-gray-600">{po.vendors?.name ?? '—'}</Link>
                  </TD>
                  <TD className="text-sm text-gray-700">{po.associations?.name ?? '—'}</TD>
                  <TD>
                    <span className="inline-flex flex-wrap gap-1"><ApprovalStatusChip po={po} /><OrderStatusChip status={po.status} /></span>
                  </TD>
                  <TD className="text-sm text-gray-600">{po.needed_by ? date(po.needed_by) : '—'}</TD>
                  <TD className="text-right tabular-nums font-medium text-gray-900">{money(po.po_total)}</TD>
                  <TD className="text-right tabular-nums text-gray-600">{money(po.po_billed)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={FileSpreadsheet}
              title={q || filter !== 'all' ? 'No purchase orders match this filter' : 'No purchase orders yet'}
              description="Create a purchase order to commit spend with a vendor before work begins."
              action={<Link href="/purchase-orders/new"><Button><Plus className="h-4 w-4" /> New PO</Button></Link>}
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
