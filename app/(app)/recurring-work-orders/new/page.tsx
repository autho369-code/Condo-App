import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['plumbing', 'electrical', 'hvac', 'general_repair', 'common_area', 'appliance', 'pest_control', 'landscaping', 'other'];
const PRIORITIES = ['low', 'normal', 'high', 'emergency'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'annually'];
const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default async function NewRecurringWorkOrderPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const [{ data: associations }, { data: units }, { data: vendors }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('units').select('id, unit_number, buildings!inner(association_id, associations(name))').is('archived_at', null).order('unit_number'),
    db.from('vendors').select('id, name').is('archived_at', null).order('name'),
  ]);

  async function createRecurring(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const associationId = (formData.get('association_id') as string) || null;
    const title = (formData.get('title') as string)?.trim();
    if (!associationId) redirect('/recurring-work-orders/new?error=' + encodeURIComponent('Select an association.'));
    if (!title) redirect('/recurring-work-orders/new?error=' + encodeURIComponent('Enter a title.'));
    const startDate = (formData.get('start_date') as string) || new Date().toISOString().slice(0, 10);
    const interval = parseInt(formData.get('interval_count') as string, 10);
    const { error } = await (supabase as any).from('recurring_work_orders').insert({
      portfolio_id: me.portfolio?.id,
      association_id: associationId,
      unit_id: (formData.get('unit_id') as string) || null,
      vendor_id: (formData.get('vendor_id') as string) || null,
      title,
      description: (formData.get('description') as string)?.trim() || null,
      category: (formData.get('category') as string) || null,
      priority: (formData.get('priority') as string) || 'normal',
      frequency: (formData.get('frequency') as string) || 'monthly',
      interval_count: Number.isFinite(interval) && interval > 0 ? interval : 1,
      start_date: startDate,
      next_due_date: startDate,
      auto_generate: formData.get('auto_generate') === 'on',
      created_by: me.auth_user_id,
    });
    if (error) redirect('/recurring-work-orders/new?error=' + encodeURIComponent(error.message));
    redirect('/recurring-work-orders');
  }

  return (
    <DataWorkspace title="New Recurring Work Order" description="Set up a maintenance task that regenerates on a schedule." actions={<Link href="/recurring-work-orders"><Button variant="secondary">Back to recurring work orders</Button></Link>}>
      <form action={createRecurring} className="max-w-3xl space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not create recurring work order">{sp.error}</Alert>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="association_id">Association <span className="text-red-500">*</span></Label>
            <select id="association_id" name="association_id" required className={inputCls}><option value="">Select association</option>{(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </div>
          <div>
            <Label htmlFor="unit_id">Unit (optional)</Label>
            <select id="unit_id" name="unit_id" className={inputCls}><option value="">Common area / no specific unit</option>{(units ?? []).map((u: any) => <option key={u.id} value={u.id}>{u.buildings?.associations?.name ? `${u.buildings.associations.name} · ` : ''}Unit {u.unit_number}</option>)}</select>
          </div>
        </div>
        <div><Label htmlFor="title">Title <span className="text-red-500">*</span></Label><Input id="title" name="title" required placeholder="e.g. Quarterly HVAC filter change" /></div>
        <div><Label htmlFor="description">Description</Label><textarea id="description" name="description" rows={2} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Optional" /></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="category">Category</Label>
            <select id="category" name="category" defaultValue="general_repair" className={`${inputCls} capitalize`}>{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}</select>
          </div>
          <div>
            <Label htmlFor="priority">Priority</Label>
            <select id="priority" name="priority" defaultValue="normal" className={`${inputCls} capitalize`}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
          </div>
          <div>
            <Label htmlFor="vendor_id">Vendor</Label>
            <select id="vendor_id" name="vendor_id" className={inputCls}><option value="">Unassigned</option>{(vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
          </div>
          <div>
            <Label htmlFor="frequency">Frequency</Label>
            <select id="frequency" name="frequency" defaultValue="monthly" className={`${inputCls} capitalize`}>{FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}</select>
          </div>
          <div><Label htmlFor="interval_count">Every (interval)</Label><Input id="interval_count" name="interval_count" type="number" min="1" defaultValue={1} /></div>
          <div><Label htmlFor="start_date">Start date</Label><Input id="start_date" name="start_date" type="date" /></div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="auto_generate" defaultChecked className="accent-blue-600" /> Automatically generate work orders on schedule</label>
        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/recurring-work-orders" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Create recurring work order</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
