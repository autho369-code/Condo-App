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
const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default async function NewWorkOrderPage({ searchParams }: { searchParams: Promise<{ error?: string; unit?: string; association?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: associations }, { data: units }, { data: vendors }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('units').select('id, unit_number, buildings!inner(association_id, associations(name))').is('archived_at', null).order('unit_number'),
    db.from('vendors').select('id, name').is('archived_at', null).order('name'),
  ]);

  async function createWorkOrder(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const associationId = (formData.get('association_id') as string) || null;
    const title = (formData.get('title') as string)?.trim();
    if (!associationId) redirect('/work-orders/new?error=' + encodeURIComponent('Select an association.'));
    if (!title) redirect('/work-orders/new?error=' + encodeURIComponent('Enter a title for the work order.'));

    const { data: wo, error } = await (supabase as any).from('work_orders').insert({
      portfolio_id: me.portfolio?.id,
      association_id: associationId,
      unit_id: (formData.get('unit_id') as string) || null,
      title,
      description: (formData.get('description') as string)?.trim() || null,
      category: (formData.get('category') as string) || 'other',
      priority: (formData.get('priority') as string) || 'normal',
      status: 'new',
      vendor_id: (formData.get('vendor_id') as string) || null,
      scheduled_date: (formData.get('scheduled_date') as string) || null,
      requested_by: (formData.get('requested_by') as string)?.trim() || null,
      internal_notes: (formData.get('internal_notes') as string)?.trim() || null,
      owner_approved: false,
      withheld_amount_from_owner: 0,
      created_by: me.auth_user_id,
    }).select('id').single();
    if (error || !wo) redirect('/work-orders/new?error=' + encodeURIComponent(error?.message ?? 'Could not create work order.'));
    redirect(`/work-orders/${wo.id}`);
  }

  return (
    <DataWorkspace
      title="New Work Order"
      description="Create a maintenance or repair work order for a unit or common area."
      actions={<Link href="/work-orders"><Button variant="secondary">Back to work orders</Button></Link>}
    >
      <form action={createWorkOrder} className="max-w-4xl space-y-6 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not create work order">{sp.error}</Alert>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="association_id">Association <span className="text-red-500">*</span></Label>
            <select id="association_id" name="association_id" required defaultValue={sp.association ?? ''} className={inputCls}>
              <option value="">Select association</option>
              {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="unit_id">Unit (optional)</Label>
            <select id="unit_id" name="unit_id" defaultValue={sp.unit ?? ''} className={inputCls}>
              <option value="">Common area / no specific unit</option>
              {(units ?? []).map((u: any) => (
                <option key={u.id} value={u.id}>{u.buildings?.associations?.name ? `${u.buildings.associations.name} · ` : ''}Unit {u.unit_number}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
          <Input id="title" name="title" required placeholder="e.g. Leaking faucet in kitchen" />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <textarea id="description" name="description" rows={4} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Describe the issue, location, and any access notes…" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="category">Category</Label>
            <select id="category" name="category" defaultValue="general_repair" className={`${inputCls} capitalize`}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="priority">Priority</Label>
            <select id="priority" name="priority" defaultValue="normal" className={`${inputCls} capitalize`}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="scheduled_date">Scheduled date</Label>
            <Input id="scheduled_date" name="scheduled_date" type="date" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="vendor_id">Assign vendor (optional)</Label>
            <select id="vendor_id" name="vendor_id" className={inputCls}>
              <option value="">Unassigned</option>
              {(vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="requested_by">Requested by</Label>
            <Input id="requested_by" name="requested_by" placeholder="Owner, board member, staff…" />
          </div>
        </div>

        <div>
          <Label htmlFor="internal_notes">Internal notes</Label>
          <textarea id="internal_notes" name="internal_notes" rows={2} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Not shown to owners or vendors." />
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/work-orders" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Create work order</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
