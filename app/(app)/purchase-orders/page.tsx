import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrdersPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('purchase_orders')
    .select('id, number, status, po_total, po_billed, created_at, vendors(name), associations(name), work_orders(id, title)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <ModulePage title="Purchase Orders" description="POs issued to vendors — approved before work begins, reconciled against vendor bills.">
      {rows && rows.length > 0 ? (
        <Table>
          <THead><TR><TH>PO #</TH><TH>Vendor</TH><TH>Association</TH><TH>Work order</TH><TH>Status</TH><TH className="text-right">Total</TH><TH className="text-right">Billed</TH></TR></THead>
          <tbody>
            {rows.map((p: any) => (
              <TR key={p.id}>
                <TD className="font-mono text-xs">{p.number ?? p.id.slice(0, 8)}</TD>
                <TD>{p.vendors?.name}</TD>
                <TD className="text-sm text-gray-700">{p.associations?.name ?? '—'}</TD>
                <TD className="text-xs text-gray-500">{p.work_orders?.title ?? '—'}</TD>
                <TD><span className="rounded bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-700">{p.status}</span></TD>
                <TD className="text-right tabular-nums">{money(p.po_total)}</TD>
                <TD className="text-right tabular-nums text-gray-600">{money(p.po_billed)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">No purchase orders issued yet.</p>
      )}
    </ModulePage>
  );
}
