import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const STATUS = ['scheduled', 'in_progress', 'completed', 'cancelled'];
const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default async function NewInspectionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const [{ data: associations }, { data: units }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('units').select('id, unit_number, buildings!inner(association_id, associations(name))').is('archived_at', null).order('unit_number'),
  ]);

  async function createInspection(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const associationId = (formData.get('association_id') as string) || null;
    if (!associationId) redirect('/inspections/new?error=' + encodeURIComponent('Select an association.'));
    const { error } = await (supabase as any).from('inspections').insert({
      portfolio_id: me.portfolio?.id,
      association_id: associationId,
      unit_id: (formData.get('unit_id') as string) || null,
      inspection_type: (formData.get('inspection_type') as string)?.trim() || null,
      scheduled_date: (formData.get('scheduled_date') as string) || null,
      status: (formData.get('status') as string) || 'scheduled',
      notes: (formData.get('notes') as string)?.trim() || null,
      created_by: me.auth_user_id,
    });
    if (error) redirect('/inspections/new?error=' + encodeURIComponent(error.message));
    redirect('/inspections');
  }

  return (
    <DataWorkspace title="New Inspection" description="Schedule a property or unit inspection." actions={<Link href="/inspections"><Button variant="secondary">Back to inspections</Button></Link>}>
      <form action={createInspection} className="max-w-2xl space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not create inspection">{sp.error}</Alert>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="association_id">Association <span className="text-red-500">*</span></Label>
            <select id="association_id" name="association_id" required className={inputCls}><option value="">Select association</option>{(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </div>
          <div>
            <Label htmlFor="unit_id">Unit (optional)</Label>
            <select id="unit_id" name="unit_id" className={inputCls}><option value="">Common area / whole property</option>{(units ?? []).map((u: any) => <option key={u.id} value={u.id}>{u.buildings?.associations?.name ? `${u.buildings.associations.name} · ` : ''}Unit {u.unit_number}</option>)}</select>
          </div>
          <div><Label htmlFor="inspection_type">Inspection type</Label><Input id="inspection_type" name="inspection_type" placeholder="e.g. Move-in, Annual, Move-out" /></div>
          <div><Label htmlFor="scheduled_date">Scheduled date</Label><Input id="scheduled_date" name="scheduled_date" type="date" /></div>
          <div>
            <Label htmlFor="status">Status</Label>
            <select id="status" name="status" defaultValue="scheduled" className={`${inputCls} capitalize`}>{STATUS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select>
          </div>
        </div>
        <div><Label htmlFor="notes">Notes</Label><textarea id="notes" name="notes" rows={3} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Optional" /></div>
        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/inspections" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Schedule inspection</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
