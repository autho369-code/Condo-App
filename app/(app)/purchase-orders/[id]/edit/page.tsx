import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { PurchaseOrderForm } from '@/components/purchase-orders/po-form';
import { Button } from '@/components/ui/button';
import { requireFinanceStaff } from '@/lib/auth/me';
import { loadPurchaseOrderFormOptions } from '@/lib/purchase-orders/form-options';
import { savePurchaseOrder } from '@/lib/rpcs/purchase-orders';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function EditPurchaseOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await requireFinanceStaff();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: po }, { data: lines }] = await Promise.all([
    db.from('purchase_orders')
      .select('id, association_id, vendor_id, work_order_id, number, description, needed_by, notes, status, approval_status')
      .eq('id', id)
      .maybeSingle(),
    db.from('purchase_order_line_items')
      .select('description, qty, unit_price, gl_account_id')
      .eq('purchase_order_id', id)
      .order('sort_order'),
  ]);
  if (!po) notFound();
  if (po.status === 'cancelled' || !['draft', 'rejected'].includes(po.approval_status)) {
    redirect(`/purchase-orders/${id}?error=${encodeURIComponent('Only draft or rejected purchase orders can be edited.')}`);
  }

  const options = await loadPurchaseOrderFormOptions(db, me.portfolio?.id);

  return (
    <DataWorkspace
      title={`Edit PO ${po.number ?? po.id.slice(0, 8)}`}
      description={po.approval_status === 'rejected' ? 'The board rejected this order. Revise it and resubmit for a new vote.' : 'Update the draft, then submit it for approval.'}
      actions={<Link href={`/purchase-orders/${id}`}><Button variant="secondary">Back to purchase order</Button></Link>}
    >
      <div className="max-w-4xl">
        <PurchaseOrderForm
          action={savePurchaseOrder}
          {...options}
          initial={{ ...po, lines: (lines ?? []).map((l: any) => ({ ...l, qty: Number(l.qty), unit_price: Number(l.unit_price) })) }}
          error={sp.error}
        />
      </div>
    </DataWorkspace>
  );
}
