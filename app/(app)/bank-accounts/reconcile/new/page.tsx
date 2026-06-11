import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { SectionTitle, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function NewReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string }>;
}) {
  await requireStaff();
  const { account_id = '' } = await searchParams;

  const supabase = await createClient();
  const db = supabase as any;

  // Fetch all bank accounts
  const { data: bankAccounts } = await db
    .from('bank_accounts')
    .select('id, name, bank_name, account_type, gl_account_id, last_reconciliation_date, portfolio_id')
    .is('archived_at', null)
    .order('name');

  const accounts = (bankAccounts ?? []) as any[];

  // Get GL accounts for those with gl_account_id
  const glAccountIds = accounts
    .filter((a: any) => a.gl_account_id)
    .map((a: any) => a.gl_account_id);

  let glAccounts: any[] = [];
  if (glAccountIds.length > 0) {
    const { data: gl } = await db
      .from('gl_accounts')
      .select('id, number, name')
      .in('id', glAccountIds);
    glAccounts = gl ?? [];
  }

  // Merge GL info into accounts
  const accountsWithGL = accounts.map((a: any) => ({
    ...a,
    gl_number: glAccounts.find((g: any) => g.id === a.gl_account_id)?.number ?? '—',
    gl_name: glAccounts.find((g: any) => g.id === a.gl_account_id)?.name ?? 'No GL linked',
  }));

  return (
    <DataWorkspace
      title="New Bank Reconciliation"
      description="Start a new reconciliation by selecting a bank account, entering the statement date and ending balance."
    >
      <div className="max-w-2xl space-y-6">
        <Surface>
          <SectionTitle
            title="Reconciliation details"
            description="Enter the bank statement information to begin matching transactions."
          />

          <form action="/api/bank-reconciliation/create" method="post" className="space-y-5">
            {/* Bank Account Selection */}
            <Field
              label="Bank account"
              htmlFor="bank_account_id"
              required
              hint={
                account_id
                  ? `Last reconciled: ${date(accountsWithGL.find((a: any) => a.id === account_id)?.last_reconciliation_date)}`
                  : undefined
              }
            >
              <Select id="bank_account_id" name="bank_account_id" defaultValue={account_id} required>
                <option value="">Select a bank account…</option>
                {accountsWithGL.map((account: any) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.bank_name ?? 'No bank'}) — GL {account.gl_number}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Statement Date */}
            <Field label="Statement date" htmlFor="statement_date" required>
              <Input
                type="date"
                id="statement_date"
                name="statement_date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
              />
            </Field>

            {/* Statement Ending Balance */}
            <Field label="Statement ending balance ($)" htmlFor="statement_balance" required>
              <Input
                type="number"
                id="statement_balance"
                name="statement_balance"
                step="0.01"
                required
                placeholder="0.00"
              />
            </Field>

            {/* Notes */}
            <Field label="Notes (optional)" htmlFor="notes">
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="Any notes about this reconciliation..."
              />
            </Field>

            {/* Submit */}
            <div className="flex gap-2 pt-2">
              <Button type="submit">Start reconciliation</Button>
              <Link href={`/bank-accounts/reconcile${account_id ? `?account_id=${encodeURIComponent(account_id)}` : ''}`}>
                <Button variant="secondary" type="button">Cancel</Button>
              </Link>
            </div>
          </form>
        </Surface>
      </div>
    </DataWorkspace>
  );
}
