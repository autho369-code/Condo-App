import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
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
      rail={
        <div className="space-y-5">
          <section>
            <h2 className="text-sm font-semibold text-gray-950">Reconciliation</h2>
            <div className="mt-3 grid gap-2">
              <RailLink href="/bank-accounts/reconcile" label="Back to Reconciliations" />
              <RailLink href="/bank-accounts" label="Bank Accounts" />
              <RailLink href="/journal-entries" label="Journal Entries" />
            </div>
          </section>
        </div>
      }
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Reconciliation Details</h2>
          <p className="mt-1 text-sm text-gray-500">
            Enter the bank statement information to begin matching transactions.
          </p>

          <form action="/api/bank-reconciliation/create" method="post" className="mt-6 space-y-5">
            {/* Bank Account Selection */}
            <div>
              <label htmlFor="bank_account_id" className="block text-sm font-medium text-gray-700">
                Bank Account
              </label>
              <select
                id="bank_account_id"
                name="bank_account_id"
                defaultValue={account_id}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Select a bank account...</option>
                {accountsWithGL.map((account: any) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.bank_name ?? 'No bank'}) — GL {account.gl_number}
                  </option>
                ))}
              </select>
              {account_id && (
                <p className="mt-1 text-xs text-gray-500">
                  Last reconciled: {date(accountsWithGL.find((a: any) => a.id === account_id)?.last_reconciliation_date)}
                </p>
              )}
            </div>

            {/* Statement Date */}
            <div>
              <label htmlFor="statement_date" className="block text-sm font-medium text-gray-700">
                Statement Date
              </label>
              <input
                type="date"
                id="statement_date"
                name="statement_date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Statement Ending Balance */}
            <div>
              <label htmlFor="statement_balance" className="block text-sm font-medium text-gray-700">
                Statement Ending Balance ($)
              </label>
              <input
                type="number"
                id="statement_balance"
                name="statement_balance"
                step="0.01"
                required
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Any notes about this reconciliation..."
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="rounded-md bg-gray-950 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Start Reconciliation
              </button>
              <Link
                href={`/bank-accounts/reconcile${account_id ? `?account_id=${encodeURIComponent(account_id)}` : ''}`}
                className="rounded-md border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </DataWorkspace>
  );
}

function RailLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
    >
      {label}
    </Link>
  );
}
