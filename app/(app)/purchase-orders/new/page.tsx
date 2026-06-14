import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default async function NewPurchaseOrderPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const [{ data: associations }, { data: vendors }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('vendors').select('id, name').is('archived_at', null).order('name'),
  ]);

  async function createPO(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const associationId = (formData.get('association_id') as string) || null;
    const vendorId = (formData.get('vendor_id') as string) || null;
    if (!associationId) redirect('/purchase-orders/new?error=' + encodeURIComponent('Select an association.'));
    if (!vendorId) redirect('/purchase-orders/new?error=' + encodeURIComponent('Select a vendor.'));
    const total = parseFloat(formData.get('po_total') as string);
    const { error } = await (supabase as any).from('purchase_orders').insert({
      portfolio_id: me.portfolio?.id,
      association_id: associationId,
      vendor_id: vendorId,
      number: (formData.get('number') as string)?.trim() || null,
      status: 'open',
      po_total: Number.isFinite(total) ? total : null,
      notes: (formData.get('notes') as string)?.trim() || null,
      created_by: me.auth_user_id,
    });
    if (error) redirect('/purchase-orders/new?error=' + encodeURIComponent(error.message));
    redirect('/purchase-orders');
  }

  return (
    <DataWorkspace title="New Purchase Order" description="Open a purchase order for a vendor." actions={<Link href="/purchase-orders"><Button variant="secondary">Back to purchase orders</Button></Link>}>
      <form action={createPO} className="max-w-2xl space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not create purchase order">{sp.error}</Alert>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="association_id">Association <span className="text-red-500">*</span></Label>
            <select id="association_id" name="association_id" required className={inputCls}><option value="">Select association</option>{(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </div>
          <div>
            <Label htmlFor="vendor_id">Vendor <span className="text-red-500">*</span></Label>
            <select id="vendor_id" name="vendor_id" required className={inputCls}><option value="">Select vendor</option>{(vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
          </div>
          <div><Label htmlFor="number">PO number</Label><Input id="number" name="number" placeholder="Optional" /></div>
          <div><Label htmlFor="po_total">PO total</Label><Input id="po_total" name="po_total" type="number" step="0.01" min="0" placeholder="0.00" /></div>
        </div>
        <div><Label htmlFor="notes">Notes</Label><textarea id="notes" name="notes" rows={3} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Scope of work, terms…" /></div>
        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/purchase-orders" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Create purchase order</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
