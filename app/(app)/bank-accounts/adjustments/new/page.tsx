import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewBankAdjustmentPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: accounts } = await (supabase as any).from('bank_accounts').select('id, name').order('name');

  async function handleSubmit(formData: FormData) {
    'use server';
    await (await import('@/lib/auth/me')).requireStaff();  // in-action guard
    const supabase = await createClient();
    const { error } = await (supabase as any).from('bank_adjustments').insert({
      bank_account_id: formData.get('bank_account_id') || null,
      amount: parseFloat(formData.get('amount') as string) || 0,
      adjustment_date: formData.get('adjustment_date') || null,
      description: formData.get('description') || '',
    });
    if (error) {
      redirect(`/bank-accounts/adjustments/new?error=${encodeURIComponent(error.message)}`);
    }
    redirect('/bank-accounts');
  }

  return (
    <DataWorkspace
      title="Bank adjustment"
      description="Create a bank-only adjustment with notes. Adjustments do not affect GL balances — use journal entries for accounting-impacting corrections."
    >
      <form action={handleSubmit} className="max-w-3xl space-y-5">
        <Alert tone="info">
          Bank adjustments do not affect General Ledger account balances.
        </Alert>
        <Surface>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Account">
              <Select name="bank_account_id">
                <option value="">Select account</option>
                {(accounts ?? []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </Select>
            </Field>
            <Field label="Amount">
              <Input name="amount" type="number" step="0.01" placeholder="$0.00" />
            </Field>
            <Field label="Adjustment date">
              <Input name="adjustment_date" type="date" />
            </Field>
          </div>
          <Field label="Description" className="mt-4">
            <Textarea name="description" rows={3} placeholder="Description" />
          </Field>
        </Surface>
        <div className="flex justify-start">
          <Button type="submit">Create adjustment</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
