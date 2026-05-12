import Link from 'next/link';
import { AccountingPage } from '@/components/accounting/accounting-page';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { maskBankNumber } from '@/lib/banking/bank-format';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BankAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; bank?: string }>;
}) {
  await requireStaff();
  const { filter = '', q = '', bank = '' } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  let query = db
    .from('bank_accounts')
    .select('id, name, bank_name, account_number, routing_number, account_type, payments_enabled, auto_reconciliation, last_reconciliation_date, next_check_number, associations(name)')
    .is('archived_at', null)
    .order('name');

  if (filter === 'unreconciled') query = query.is('last_reconciliation_date', null);
  if (q) query = query.ilike('name', `%${q}%`);
  if (bank) query = query.ilike('bank_name', `%${bank}%`);

  const { data: rows } = await query;
  const accounts = rows ?? [];

  return (
    <AccountingPage active="bank-accounts" title={filter === 'unreconciled' ? 'Unreconciled Bank Accounts' : 'Bank Accounts'}>
      <div className="space-y-4">
        <form action="/bank-accounts" className="flex flex-wrap items-end gap-3 text-xs">
          <label className="grid gap-1 text-ink-700">
            <span>Account Name</span>
            <input name="q" defaultValue={q} className="h-8 w-64 border border-ink-300 bg-white px-2 text-sm text-ink-900" />
          </label>
          <label className="grid gap-1 text-ink-700">
            <span>Bank</span>
            <input name="bank" defaultValue={bank} className="h-8 w-52 border border-ink-300 bg-white px-2 text-sm text-ink-900" />
          </label>
          <input type="hidden" name="filter" value={filter} />
          <button type="submit" className="h-8 border border-ink-900 bg-white px-4 text-xs text-ink-900">More Filters...</button>
          <Link href="/bank-accounts" className="flex h-8 items-center bg-ink-100 px-4 text-xs text-ink-500">Clear Filters</Link>
        </form>

        {accounts.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Account Name</TH>
                <TH>Bank</TH>
                <TH>Account Number</TH>
                <TH>Last Reconciliation</TH>
                <TH>Payments Enabled</TH>
                <TH>Auto-Reconciliation</TH>
              </TR>
            </THead>
            <tbody>
              {accounts.map((account: any) => (
                <TR key={account.id}>
                  <TD>
                    <Link href={`/bank-accounts/${account.id}`} className="font-medium text-brand-700 hover:underline">
                      {account.name}
                    </Link>
                  </TD>
                  <TD className="text-sm text-ink-700">{account.bank_name ?? 'Not provided'}</TD>
                  <TD className="text-sm text-ink-600">{maskBankNumber(account.account_number)}</TD>
                  <TD className="text-sm text-ink-600">{date(account.last_reconciliation_date)}</TD>
                  <TD><StatusChip tone={account.payments_enabled ? 'success' : 'neutral'}>{account.payments_enabled ? 'Enabled' : 'Not enabled'}</StatusChip></TD>
                  <TD><StatusChip tone={account.auto_reconciliation ? 'info' : 'neutral'}>{account.auto_reconciliation ? 'Enabled' : 'Not enabled'}</StatusChip></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">
            No bank accounts match this view.
          </p>
        )}
      </div>
    </AccountingPage>
  );
}
