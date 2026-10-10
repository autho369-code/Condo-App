import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const BACK = '/bank-accounts/adjustments/new';

export default async function NewBankAdjustmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  // Adjustments are finance records (RLS: can_manage_finance on the account).
  const me = await requireFinanceStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const { data: accounts } = await db
    .from('bank_accounts')
    .select('id, name')
    .eq('portfolio_id', me.portfolio?.id)
    .is('archived_at', null)
    .order('name');
  const accountIds = (accounts ?? []).map((a: any) => a.id);
  const { data: recent } = accountIds.length > 0
    ? await db
        .from('bank_adjustments')
        .select('id, amount, adjustment_date, description, created_at, bank_accounts(name)')
        .in('bank_account_id', accountIds)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: [] };

  async function handleSubmit(formData: FormData) {
    'use server';
    const me = await requireFinanceStaff();  // in-action guard
    const fail = (message: string): never => redirect(`${BACK}?error=${encodeURIComponent(message)}`);
    const bankAccountId = String(formData.get('bank_account_id') ?? '');
    const amount = Number(formData.get('amount'));
    const adjustmentDate = String(formData.get('adjustment_date') ?? '');
    const description = String(formData.get('description') ?? '').trim();
    if (!bankAccountId) fail('Choose a bank account.');
    if (!Number.isFinite(amount) || amount === 0) fail('Enter a non-zero amount (negative for a decrease).');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(adjustmentDate)) fail('Enter the adjustment date.');
    if (!description) fail('Describe the adjustment so it can be reconciled later.');

    const supabase = await createClient();
    const db = supabase as any;
    const { data: account } = await db
      .from('bank_accounts')
      .select('id')
      .eq('id', bankAccountId)
      .eq('portfolio_id', me.portfolio?.id)
      .maybeSingle();
    if (!account) fail('That bank account was not found.');

    const { error } = await db.from('bank_adjustments').insert({
      bank_account_id: bankAccountId,
      amount: Math.round(amount * 100) / 100,
      adjustment_date: adjustmentDate,
      description: description.slice(0, 2000),
    });
    if (error) fail(error.message);
    redirect(`${BACK}?saved=1`);
  }

  return (
    <DataWorkspace
      title="Bank adjustment"
      description="Record a bank-only item (a bank error or a charge the books should not carry). It does not affect GL balances; it appears on the next bank reconciliation as a Bank Only item to clear against the statement."
    >
      <form action={handleSubmit} className="max-w-3xl space-y-5">
        {sp.error && <Alert tone="danger" title="Adjustment not saved">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success" title="Adjustment saved">It is listed under Recent adjustments below.</Alert>}
        <Alert tone="info">
          Bank adjustments do not affect General Ledger account balances.
        </Alert>
        <Surface>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Account" required>
              <Select name="bank_account_id" required defaultValue="">
                <option value="" disabled>Select account</option>
                {(accounts ?? []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </Select>
            </Field>
            <Field label="Amount" required>
              <Input name="amount" type="number" step="0.01" required placeholder="$0.00" />
            </Field>
            <Field label="Adjustment date" required>
              <Input name="adjustment_date" type="date" required />
            </Field>
          </div>
          <Field label="Description" required className="mt-4">
            <Textarea name="description" rows={3} required maxLength={2000} placeholder="Description" />
          </Field>
        </Surface>
        <div className="flex justify-start">
          <Button type="submit">Create adjustment</Button>
        </div>
      </form>

      <Surface className="mt-8 max-w-3xl">
        <h2 className="text-sm font-semibold text-gray-900">Recent adjustments</h2>
        {(recent ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No bank adjustments yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[12.5px] uppercase tracking-wide text-gray-500">
                <tr><th className="py-2 pr-4 font-medium">Date</th><th className="py-2 pr-4 font-medium">Account</th><th className="py-2 pr-4 font-medium">Description</th><th className="py-2 text-right font-medium">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(recent ?? []).map((r: any) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4 tabular-nums text-gray-700">{date(r.adjustment_date)}</td>
                    <td className="py-2 pr-4 text-gray-700">{r.bank_accounts?.name ?? '—'}</td>
                    <td className="py-2 pr-4 text-gray-700">{r.description || '—'}</td>
                    <td className="py-2 text-right tabular-nums text-gray-900">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </DataWorkspace>
  );
}
