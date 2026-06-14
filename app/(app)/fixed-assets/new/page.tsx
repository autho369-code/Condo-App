import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DEPR = ['straight_line', 'declining_balance', 'sum_of_years_digits', 'units_of_production', 'none'];
const STATUS = ['active', 'disposed', 'sold', 'fully_depreciated'];
const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default async function NewFixedAssetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: associations } = await (supabase as any).from('associations').select('id, name').is('archived_at', null).order('name');

  async function createAsset(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const name = (formData.get('name') as string)?.trim();
    if (!name) redirect('/fixed-assets/new?error=' + encodeURIComponent('Enter an asset name.'));
    const price = parseFloat(formData.get('purchase_price') as string);
    const life = parseInt(formData.get('useful_life_years') as string, 10);
    const { error } = await (supabase as any).from('fixed_assets').insert({
      portfolio_id: me.portfolio?.id,
      association_id: (formData.get('association_id') as string) || null,
      name,
      description: (formData.get('description') as string)?.trim() || null,
      asset_type: (formData.get('asset_type') as string)?.trim() || null,
      purchase_date: (formData.get('purchase_date') as string) || null,
      purchase_price: Number.isFinite(price) ? price : null,
      useful_life_years: Number.isFinite(life) ? life : null,
      depreciation_method: (formData.get('depreciation_method') as string) || null,
      status: (formData.get('status') as string) || 'active',
      created_by: me.auth_user_id,
    });
    if (error) redirect('/fixed-assets/new?error=' + encodeURIComponent(error.message));
    redirect('/fixed-assets');
  }

  return (
    <DataWorkspace title="New Fixed Asset" description="Add a depreciable asset to the register." actions={<Link href="/fixed-assets"><Button variant="secondary">Back to fixed assets</Button></Link>}>
      <form action={createAsset} className="max-w-2xl space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not create asset">{sp.error}</Alert>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div><Label htmlFor="name">Asset name <span className="text-red-500">*</span></Label><Input id="name" name="name" required placeholder="e.g. Pool pump" /></div>
          <div><Label htmlFor="asset_type">Asset type</Label><Input id="asset_type" name="asset_type" placeholder="e.g. Equipment" /></div>
          <div>
            <Label htmlFor="association_id">Association</Label>
            <select id="association_id" name="association_id" className={inputCls}><option value="">Portfolio-wide</option>{(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </div>
          <div><Label htmlFor="purchase_date">Purchase date</Label><Input id="purchase_date" name="purchase_date" type="date" /></div>
          <div><Label htmlFor="purchase_price">Purchase price</Label><Input id="purchase_price" name="purchase_price" type="number" step="0.01" min="0" placeholder="0.00" /></div>
          <div><Label htmlFor="useful_life_years">Useful life (years)</Label><Input id="useful_life_years" name="useful_life_years" type="number" min="0" /></div>
          <div>
            <Label htmlFor="depreciation_method">Depreciation method</Label>
            <select id="depreciation_method" name="depreciation_method" defaultValue="straight_line" className={`${inputCls} capitalize`}>{DEPR.map((d) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}</select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <select id="status" name="status" defaultValue="active" className={`${inputCls} capitalize`}>{STATUS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select>
          </div>
        </div>
        <div><Label htmlFor="description">Description</Label><Input id="description" name="description" placeholder="Optional" /></div>
        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/fixed-assets" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Create asset</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
