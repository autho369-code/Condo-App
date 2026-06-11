import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/input';
import { Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewBankDepositPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: accounts }, { data: associations }] = await Promise.all([
    (supabase as any).from('bank_accounts').select('id, name').order('name'),
    (supabase as any).from('associations').select('id, name').order('name'),
  ]);

  async function handleSubmit(formData: FormData) {
    'use server';
    redirect(`/bank-accounts/deposits?account=${formData.get('bank_account_id') || ''}&assoc=${formData.get('association_id') || ''}`);
  }

  return (
    <DataWorkspace
      title="New bank deposit"
      description="Select the bank account and scope, then search open items to build a deposit worksheet. Deposits are posted to the General Ledger when confirmed."
    >
      <Surface className="max-w-3xl">
        <form action={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank account">
              <Select name="bank_account_id">
                <option value="">Select account</option>
                {(accounts ?? []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </Select>
            </Field>
            <Field label="Association">
              <Select name="association_id">
                <option value="">All associations</option>
                {(associations ?? []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-6">
            <Button type="submit">Search open items</Button>
          </div>
        </form>
      </Surface>
    </DataWorkspace>
  );
}
