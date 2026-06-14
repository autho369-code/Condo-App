import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ACCOUNT_TYPES = ['asset', 'cash', 'accounts_receivable', 'fixed_asset', 'liability', 'accounts_payable', 'equity', 'income', 'other_income', 'expense', 'cost_of_goods_sold', 'other_expense', 'non_operating'];
const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default async function NewGlAccountPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: associations } = await db.from('associations').select('id, name').is('archived_at', null).order('name');

  async function createGlAccount(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const number = parseInt(formData.get('number') as string, 10);
    const name = (formData.get('name') as string)?.trim();
    const accountType = formData.get('account_type') as string;
    if (!Number.isFinite(number)) redirect('/gl-accounts/new?error=' + encodeURIComponent('Enter an account number.'));
    if (number < 1000 || number > 9999) redirect('/gl-accounts/new?error=' + encodeURIComponent('Account number must be between 1000 and 9999.'));
    if (!name) redirect('/gl-accounts/new?error=' + encodeURIComponent('Enter an account name.'));
    if (!accountType) redirect('/gl-accounts/new?error=' + encodeURIComponent('Select an account type.'));

    const { error } = await (supabase as any).from('gl_accounts').insert({
      portfolio_id: me.portfolio?.id,
      association_id: (formData.get('association_id') as string) || null,
      number,
      name,
      account_type: accountType,
      description: (formData.get('description') as string)?.trim() || null,
      include_on_cash_flow: formData.get('include_on_cash_flow') === 'on',
      subject_to_management_fees: formData.get('subject_to_management_fees') === 'on',
      active: true,
    });
    if (error) redirect('/gl-accounts/new?error=' + encodeURIComponent(error.message));
    redirect('/gl-accounts/new?created=1');
  }

  return (
    <DataWorkspace
      title="New GL Account"
      description="Add a general ledger account to the chart of accounts."
      actions={<Link href="/gl-accounts"><Button variant="secondary">Back to GL accounts</Button></Link>}
    >
      <form action={createGlAccount} className="max-w-2xl space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not create account">{sp.error}</Alert>}
        {sp.created === '1' && <Alert tone="success" title="GL account created">The account was added to the chart of accounts.</Alert>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="number">Account number <span className="text-red-500">*</span></Label>
            <Input id="number" name="number" type="number" min={1000} max={9999} required placeholder="e.g. 4100" />
            <p className="mt-1 text-xs text-gray-400">4-digit number, 1000–9999</p>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="name">Account name <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" required placeholder="e.g. Assessment Income" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="account_type">Account type <span className="text-red-500">*</span></Label>
            <select id="account_type" name="account_type" required className={`${inputCls} capitalize`}>
              <option value="">Select type</option>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="association_id">Association (optional)</Label>
            <select id="association_id" name="association_id" className={inputCls}>
              <option value="">Portfolio-wide</option>
              {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" placeholder="Optional notes about this account" />
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="include_on_cash_flow" defaultChecked className="accent-blue-600" /> Include on cash flow statement
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="subject_to_management_fees" className="accent-blue-600" /> Subject to management fees
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/gl-accounts" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Create account</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
