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

export default async function NewChargePage({ searchParams }: { searchParams: Promise<{ error?: string; posted?: string; unit?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: units }, { data: categories }] = await Promise.all([
    db.from('units').select('id, unit_number, buildings!inner(association_id, associations(name))').is('archived_at', null).order('unit_number'),
    db.from('charge_categories').select('id, name, default_amount, charge_type').eq('portfolio_id', me.portfolio?.id).eq('active', true).is('archived_at', null).order('sort_order'),
  ]);

  async function createCharge(formData: FormData) {
    'use server';
    await requireStaff();
    const supabase = await createClient();
    const unitId = formData.get('unit_id') as string;
    const categoryId = formData.get('charge_category_id') as string;
    const amount = parseFloat(formData.get('amount') as string);
    if (!unitId) redirect('/charges/new?error=' + encodeURIComponent('Select a unit.'));
    if (!categoryId) redirect('/charges/new?error=' + encodeURIComponent('Select a charge category.'));
    if (!Number.isFinite(amount) || amount <= 0) redirect('/charges/new?error=' + encodeURIComponent('Enter an amount greater than zero.'));

    const { error } = await (supabase as any).rpc('post_ad_hoc_charge', {
      p_unit_id: unitId,
      p_charge_category_id: categoryId,
      p_amount: amount,
      p_description: (formData.get('description') as string)?.trim() || null,
      p_due_date: (formData.get('due_date') as string) || undefined,
    });
    if (error) redirect('/charges/new?error=' + encodeURIComponent(error.message));
    redirect('/charges/new?posted=1');
  }

  return (
    <DataWorkspace
      title="New Charge"
      description="Post a one-time charge to a unit — assessments, fees, fines, or other line items."
      actions={<Link href="/charges"><Button variant="secondary">Back to receivables</Button></Link>}
    >
      <form action={createCharge} className="max-w-2xl space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not post charge">{sp.error}</Alert>}
        {sp.posted === '1' && <Alert tone="success" title="Charge posted">The charge was added to the unit&apos;s ledger.</Alert>}

        <div>
          <Label htmlFor="unit_id">Unit <span className="text-red-500">*</span></Label>
          <select id="unit_id" name="unit_id" required defaultValue={sp.unit ?? ''} className={inputCls}>
            <option value="">Select unit</option>
            {(units ?? []).map((u: any) => (
              <option key={u.id} value={u.id}>{u.buildings?.associations?.name ? `${u.buildings.associations.name} · ` : ''}Unit {u.unit_number}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="charge_category_id">Charge category <span className="text-red-500">*</span></Label>
            <select id="charge_category_id" name="charge_category_id" required className={inputCls}>
              <option value="">Select category</option>
              {(categories ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="amount">Amount <span className="text-red-500">*</span></Label>
            <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="due_date">Due date</Label>
            <Input id="due_date" name="due_date" type="date" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="e.g. Q3 special assessment" />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/charges" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Post charge</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
