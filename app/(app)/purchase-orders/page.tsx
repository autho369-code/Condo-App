import Link from 'next/link';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { date, money } from '@/lib/utils';
import { ApprovalStatusChip, OrderStatusChip } from './status-chips';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'pending_approval', label: 'Awaiting board' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

function matchesFilter(po: any, filter: string) {
  if (filter === 'all') return true;
  if (filter === 'cancelled') return po.status === 'cancelled';
  return po.status !== 'cancelled' && po.approval_status === filter;
}

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireFinanceStaff();
  const { status: statusParam, q = '' } = await searchParams;
  const filter = FILTERS.some((f) => f.value === statusParam) ? statusParam! : 'all';
  const supabase = await createClient();

  const { data } = await (supabase as any)
    .from('purchase_orders')
    .select('id, number, status, approval_status, approval_required, po_total, po_billed, needed_by, created_at, vendors(name), associations(name)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(500);
  const pos = (data ?? []) as any[];

  const ql = q.trim().toLowerCase();
  const rows = pos.filter((po) =>
    matchesFilter(po, filter) &&
    (!ql ||
      (po.number ?? '').toLowerCase().includes(ql) ||
      (po.vendors?.name ?? '').toLowerCase().includes(ql) ||
      (po.associations?.name ?? '').toLowerCase().includes(ql)),
  );

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
    const s = params.toString();
    return s ? `/purchase-orders?${s}` : '/purchase-orders';
  };

  return (
    <DataWorkspace
      title="Purchase Orders"
      description="Commit spend before work starts. Orders over an association's threshold go to its board for a vote."
      actions={
        <Link href="/purchase-orders/new">
          <Button><Plus className="h-4 w-4" /> New PO</Button>
        </Link>
      }
    >
      <div className="space-y-6">
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
