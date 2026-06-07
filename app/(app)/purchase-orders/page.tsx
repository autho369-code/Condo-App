import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireStaff();
  const { status: statusParam, q = '' } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  // ── PARALLEL: fetch POs with vendor + association + line items ──
  const [
    { data: purchaseOrders },
    { data: lineItems },
  ] = await Promise.all([
    db.from('purchase_orders')
      .select('id, number, status, po_total, po_billed, created_at, vendor_id, association_id, vendors(name), associations(name)')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('purchase_order_line_items')
      .select('id, purchase_order_id, description, qty, unit_price, line_total, sort_order, gl_account_id, gl_accounts(code, name)')
      .order('sort_order', { ascending: true })
      .limit(5000),
  ]);

  const pos = purchaseOrders ?? [];
  const allLineItems = lineItems ?? [];

  // ── Build line item lookup map ──
  const lineItemsByPO: Record<string, any[]> = {};
  for (const li of allLineItems) {
    if (!lineItemsByPO[li.purchase_order_id]) {
      lineItemsByPO[li.purchase_order_id] = [];
    }
    lineItemsByPO[li.purchase_order_id].push(li);
  }

  // ── FILTER by status ──
  let filteredPOs = pos;
  if (statusParam && statusParam !== 'all') {
    filteredPOs = filteredPOs.filter((po: any) => po.status === statusParam);
  }

  // ── SEARCH ──
  if (q) {
    const ql = q.toLowerCase();
    filteredPOs = filteredPOs.filter(
      (po: any) =>
        (po.number ?? '').toLowerCase().includes(ql) ||
        (po.vendors?.name ?? '').toLowerCase().includes(ql) ||
        (po.associations?.name ?? '').toLowerCase().includes(ql),
    );
  }

  // ── METRICS ──
  const openCount = pos.filter((po: any) => po.status === 'open').length;
  const approvedCount = pos.filter((po: any) => po.status === 'approved').length;
  const billedCount = pos.filter((po: any) => po.status === 'billed').length;
  const cancelledCount = pos.filter((po: any) => po.status === 'cancelled').length;

  const openTotal = pos
    .filter((po: any) => po.status === 'open')
    .reduce((s: number, po: any) => s + Number(po.po_total ?? 0), 0);
  const billedTotal = pos
    .filter((po: any) => po.status === 'billed')
    .reduce((s: number, po: any) => s + Number(po.po_billed ?? 0), 0);

  const metrics: Metric[] = [
    { label: 'Open', value: openCount, sublabel: money(openTotal) },
    { label: 'Approved', value: approvedCount },
    { label: 'Billed', value: billedCount, sublabel: `${money(billedTotal)} billed` },
    { label: 'Cancelled', value: cancelledCount },
  ];

  return (
    <DataWorkspace
      title="Purchase Orders"
      description="POs issued to vendors — approved before work begins, reconciled against vendor bills."
      actions={
        <Link href="/purchase-orders/new">
          <Button>+ New PO</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        {/* ── STATUS FILTERS ── */}
        <nav className="flex flex-wrap gap-1">
          <StatusFilterLink current={statusParam ?? 'all'} value="all" label="All" q={q} />
          <StatusFilterLink current={statusParam ?? 'all'} value="open" label="Open" q={q} />
          <StatusFilterLink current={statusParam ?? 'all'} value="approved" label="Approved" q={q} />
          <StatusFilterLink current={statusParam ?? 'all'} value="billed" label="Billed" q={q} />
          <StatusFilterLink current={statusParam ?? 'all'} value="cancelled" label="Cancelled" q={q} />
        </nav>

        {/* ── SEARCH ── */}
        <form action="/purchase-orders" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search PO #, vendor, association..."
            className="rounded border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 w-80"
          />
          {statusParam && statusParam !== 'all' && (
            <input type="hidden" name="status" value={statusParam} />
          )}
          <Button type="submit" variant="secondary">Search</Button>
          {q && (
            <Link href={`/purchase-orders${statusParam && statusParam !== 'all' ? `?status=${statusParam}` : ''}`}>
              <Button variant="ghost">Clear</Button>
            </Link>
          )}
        </form>

        {/* ── PURCHASE ORDERS TABLE ── */}
        {filteredPOs.length > 0 ? (
          <div className="space-y-2">
            <Table>
              <THead>
                <TR>
                  <TH>PO #</TH>
                  <TH>Vendor</TH>
                  <TH>Association</TH>
                  <TH>Status</TH>
                  <TH className="text-right">PO Total</TH>
                  <TH className="text-right">PO Billed</TH>
                  <TH className="text-right">Line Items</TH>
                </TR>
              </THead>
              <tbody>
                {filteredPOs.map((po: any) => {
                  const items = lineItemsByPO[po.id] ?? [];
                  return (
                    <TR key={po.id}>
                      <TD className="font-mono text-xs font-medium">
                        <Link href={`/purchase-orders/${po.id}`} className="text-blue-700 hover:underline">
                          {po.number ?? po.id.slice(0, 8)}
                        </Link>
                      </TD>
                      <TD className="font-medium text-gray-900">
                        {po.vendors?.name ?? '—'}
                      </TD>
                      <TD className="text-sm text-gray-700">
                        {po.associations?.name ?? '—'}
                      </TD>
                      <TD>
                        <POStatusChip status={po.status} />
                      </TD>
                      <TD className="text-right tabular-nums font-medium text-gray-900">
                        {money(po.po_total)}
                      </TD>
                      <TD className="text-right tabular-nums text-gray-600">
                        {money(po.po_billed)}
                      </TD>
                      <TD className="text-right tabular-nums text-sm text-gray-600">
                        {items.length}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>

            {/* ── LINE ITEMS ACCORDION (expandable per-PO) ── */}
            <LineItemsSummary
              purchaseOrders={filteredPOs}
              lineItemsByPO={lineItemsByPO}
            />
          </div>
        ) : (
          <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
            {q || (statusParam && statusParam !== 'all')
              ? 'No purchase orders match this filter.'
              : 'No purchase orders issued yet.'}
          </p>
        )}
      </div>
    </DataWorkspace>
  );
}

// ── HELPERS ──

function POStatusChip({ status }: { status: string }) {
  switch (status) {
    case 'open':
      return <StatusChip tone="warning">Open</StatusChip>;
    case 'approved':
      return <StatusChip tone="info">Approved</StatusChip>;
    case 'billed':
      return <StatusChip tone="success">Billed</StatusChip>;
    case 'cancelled':
      return <StatusChip tone="danger">Cancelled</StatusChip>;
    default:
      return <StatusChip tone="neutral">{status}</StatusChip>;
  }
}

function StatusFilterLink({
  current,
  value,
  label,
  q,
}: {
  current: string;
  value: string;
  label: string;
  q: string;
}) {
  const active = current === value;
  const params = new URLSearchParams();
  if (value !== 'all') params.set('status', value);
  if (q) params.set('q', q);
  const href = params.toString() ? `/purchase-orders?${params.toString()}` : '/purchase-orders';

  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? 'bg-gray-900 text-white'
          : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100'
      }`}
    >
      {label}
    </Link>
  );
}

function LineItemsSummary({
  purchaseOrders,
  lineItemsByPO,
}: {
  purchaseOrders: any[];
  lineItemsByPO: Record<string, any[]>;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Line Items Detail</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {purchaseOrders.map((po: any) => {
          const items = lineItemsByPO[po.id] ?? [];
          if (items.length === 0) return null;
          return (
            <div key={po.id} className="px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-xs font-medium text-gray-900">
                  {po.number ?? po.id.slice(0, 8)}
                </span>
                <span className="text-xs text-gray-500">—</span>
                <span className="text-xs text-gray-500">{po.vendors?.name ?? '—'}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                    <th className="pb-1.5 font-medium">Description</th>
                    <th className="pb-1.5 text-right font-medium">Qty</th>
                    <th className="pb-1.5 text-right font-medium">Unit Price</th>
                    <th className="pb-1.5 text-right font-medium">Line Total</th>
                    <th className="pb-1.5 font-medium">GL Account</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((li: any) => (
                    <tr key={li.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 text-gray-700">{li.description ?? '—'}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-600">{li.qty}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-600">{money(li.unit_price)}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium text-gray-900">{money(li.line_total)}</td>
                      <td className="py-1.5 text-gray-600">
                        {li.gl_accounts ? `${li.gl_accounts.code}: ${li.gl_accounts.name}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
