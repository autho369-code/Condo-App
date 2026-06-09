import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { createAdjustment } from './actions';

export const dynamic = 'force-dynamic';

export default async function NewBankAdjustmentPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: accounts } = await (supabase as any).from('bank_accounts').select('id, name').order('name');

  async function handleSubmit(formData: FormData) {
    'use server';
    await createAdjustment(formData);
    redirect('/bank-accounts');
  }

  return (
    <DataWorkspace
      title="Bank adjustment"
      description="Create a bank-only adjustment with notes. Adjustments do not affect GL balances."
      rail={<p className="text-sm leading-6 text-gray-600">Use journal entries for accounting-impacting corrections.</p>}
    >
      <form action={handleSubmit} className="space-y-5">
        <section className="rounded border border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-medium text-blue-900">Bank adjustments do not affect General Ledger account balances.</p>
        </section>
        <section className="rounded border border-gray-200 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-gray-700">Account
              <select name="bank_account_id" className="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
                <option value="">Select account</option>
                {(accounts ?? []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">Amount
              <input name="amount" type="number" step="0.01" className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" placeholder="$0.00" />
            </label>
            <label className="text-sm font-medium text-gray-700">Adjustment date
              <input name="adjustment_date" type="date" className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" />
            </label>
          </div>
          <textarea name="description" className="mt-4 w-full rounded border border-gray-300 px-3 py-2 text-sm" rows={3} placeholder="Description" />
        </section>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => window.location.href = '/bank-accounts'}>Cancel</Button>
          <Button type="submit">Create adjustment</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
