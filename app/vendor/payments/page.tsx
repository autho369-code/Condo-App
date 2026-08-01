import { createClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth/me';
import { PageHeader, Surface, SectionTitle, Badge, MetricStrip, Metric, EmptyState, Alert } from '@/components/ui/shell';
import { InvoiceSubmissionForm } from '@/components/vendor/invoice-submission-form';
import { date, money } from '@/lib/utils';
import { Receipt } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function VendorPaymentsPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const me = await requireVendor();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [billResult, workOrderResult] = await Promise.all([
    db.from('payable_bills')
      .select('id, bill_number, bill_date, due_date, amount, memo, status, paid_at, associations(name)')
      .eq('vendor_id', me.vendor_id).is('archived_at', null).order('bill_date', { ascending: false }).limit(100),
    db.from('work_orders')
      .select('id, number, title, associations(name)')
      .eq('vendor_id', me.vendor_id).is('archived_at', null).order('created_at', { ascending: false }).limit(100),
  ]);
  if (billResult.error) throw new Error(`Could not load vendor bills: ${billResult.error.message}`);
  if (workOrderResult.error) throw new Error(`Could not load assigned work orders: ${workOrderResult.error.message}`);
  const bills = billResult.data;
  const workOrders = (workOrderResult.data ?? []).map((workOrder: any) => ({
    id: workOrder.id,
    label: `${workOrder.number ? `#${workOrder.number} · ` : ''}${workOrder.title} — ${workOrder.associations?.name ?? 'Association'}`,
  }));

  const rows = bills ?? [];
  const pending = rows.filter((b: any) => b.status === 'pending_approval');
  const approved = rows.filter((b: any) => b.status === 'approved');
  const paid = rows.filter((b: any) => b.status === 'paid');
  const sum = (list: any[]) => list.reduce((s, b) => s + Number(b.amount ?? 0), 0);

  const statusLabel = (s: string | null) =>
    s === 'pending_approval' ? 'Awaiting approval' : s === 'approved' ? 'Approved — payment scheduled' : s ?? '—';

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Every invoice you've submitted and where it stands — approval, scheduled payment, or paid."
      />

      {sp.submitted === '1' && <Alert tone="success" className="mb-5">Invoice submitted for management approval.</Alert>}

      <MetricStrip className="mb-6 lg:grid-cols-3">
        <Metric label="Awaiting approval" value={money(sum(pending))} sub={`${pending.length} bill${pending.length === 1 ? '' : 's'}`} accent="amber" />
        <Metric label="Approved, unpaid" value={money(sum(approved))} sub={`${approved.length} bill${approved.length === 1 ? '' : 's'}`} accent="blue" />
        <Metric label="Paid" value={money(sum(paid))} sub={`${paid.length} bill${paid.length === 1 ? '' : 's'}`} accent="emerald" />
      </MetricStrip>

      <Surface padded={false}>
        <SectionTitle title="Bill history" className="px-5 pt-5 sm:px-6" />
        {rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No bills on file"
            description="Bills your management companies enter for your work will appear here with their approval and payment status."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Bill</th>
                  <th className="px-5 py-2.5 text-left font-medium">Association</th>
                  <th className="px-5 py-2.5 text-left font-medium">Bill Date</th>
                  <th className="px-5 py-2.5 text-left font-medium">Due</th>
                  <th className="px-5 py-2.5 text-left font-medium">Status</th>
                  <th className="px-5 py-2.5 text-left font-medium">Paid</th>
                  <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b: any) => (
                  <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{b.bill_number ?? '—'}</div>
                      {b.memo && <div className="mt-0.5 max-w-xs truncate text-xs text-gray-500">{b.memo}</div>}
                    </td>
                    <td className="px-5 py-3 text-[13px] text-gray-700">{b.associations?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(b.bill_date)}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(b.due_date)}</td>
                    <td className="px-5 py-3"><Badge status={statusLabel(b.status)} /></td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{b.paid_at ? date(b.paid_at) : '—'}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-gray-950">{money(Number(b.amount ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      <Surface className="mt-5">
        <SectionTitle title="Submit an invoice" description="Invoices enter the management approval queue and cannot mark themselves paid." />
        <InvoiceSubmissionForm workOrders={workOrders} />
      </Surface>

      <p className="mt-4 text-xs leading-5 text-gray-400">
        Payment timing questions? Contact the management company listed on the bill — approval and payment runs are
        handled by their accounting team.
      </p>
    </div>
  );
}
