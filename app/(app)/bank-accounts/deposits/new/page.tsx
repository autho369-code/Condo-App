import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { searchOpenItems } from './actions';

export const dynamic = 'force-dynamic';

export default async function NewBankDepositPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: accounts }, { data: associations }] = await Promise.all([
    (supabase as any).from('bank_accounts').select('id, name').order('name'),
    (supabase as any).from('associations').select('id, name').order('name'),
  ]);

  return (
    <DataWorkspace
      title="New bank deposit"
      description="Select the bank account and scope, then search open items to build a deposit worksheet."
      rail={<p className="text-sm leading-6 text-gray-600">Deposits are posted to the General Ledger when confirmed.</p>}
    >
      <form action={searchOpenItems as any} className="rounded border border-gray-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">Bank account
            <select name="bank_account_id" className="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
              <option value="">Select account</option>
              {(accounts ?? []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Association
            <select name="association_id" className="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
              <option value="">All associations</option>
              {(associations ?? []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="submit">Search open items</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
