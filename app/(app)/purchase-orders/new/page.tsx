import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { PurchaseOrderForm } from '@/components/purchase-orders/po-form';
import { Button } from '@/components/ui/button';
import { requireFinanceStaff } from '@/lib/auth/me';
import { loadPurchaseOrderFormOptions } from '@/lib/purchase-orders/form-options';
import { savePurchaseOrder } from '@/lib/rpcs/purchase-orders';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; association_id?: string; work_order_id?: string; vendor_id?: string }>;
}) {
  const me = await requireFinanceStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const options = await loadPurchaseOrderFormOptions(supabase as any, me.portfolio?.id);

  return (
    <DataWorkspace
      title="New Purchase Order"
      description="Itemize the work, then submit. Orders at or above the association's board threshold go to the board for a vote."
      actions={<Link href="/purchase-orders"><Button variant="secondary">Back to purchase orders</Button></Link>}
    >
      <div className="max-w-4xl">
        <PurchaseOrderForm
          action={savePurchaseOrder}
          {...options}
          initial={{ association_id: sp.association_id, work_order_id: sp.work_order_id, vendor_id: sp.vendor_id }}
          error={sp.error}
        />
      </div>
    </DataWorkspace>
  );
}
