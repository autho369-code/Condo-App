import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { updateBankAccountOnlinePayments } from '@/lib/rpcs/entities';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function BankAccountOnlinePaymentsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: accounts } = await (supabase as any)
    .from('bank_accounts')
    .select('id, name, bank_name, account_type, payments_enabled')
    .is('archived_at', null)
    .order('name');

  return (
    <DataWorkspace
      title="Enable Bank Accounts for Online Payments"
      description=""
      actions={<Link href="/bank-accounts" className="text-sm font-medium text-ink-600 hover:text-ink-900">Back to Bank Accounts</Link>}
      rail={<StatusRail accounts={accounts ?? []} />}
    >
      <div className="space-y-5">
        <form action={updateBankAccountOnlinePayments} className="rounded border border-ink-100 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_180px_auto]">
            <label className="text-sm font-medium text-ink-700">
              Bank Account
              <select name="bank_account_id" required className="mt-1 h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm text-ink-900">
                <option value="">Select account</option>
                {(accounts ?? []).map((account: any) => (
                  <option key={account.id} value={account.id}>
                    {account.name}{account.bank_name ? ` - ${account.bank_name}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-ink-700">
              Status
              <select name="payments_enabled" defaultValue="true" className="mt-1 h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm text-ink-900">
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit">Save</Button>
            </div>
          </div>
        </form>

        <AccountsTable accounts={accounts ?? []} />
      </div>
    </DataWorkspace>
  );
}

function AccountsTable({ accounts }: { accounts: any[] }) {
  if (accounts.length === 0) {
    return <p className="rounded border border-dashed border-ink-200 bg-white px-6 py-10 text-center text-sm text-ink-500">No bank accounts found.</p>;
  }

  return (
    <Table>
      <THead>
        <TR><TH>Account</TH><TH>Type</TH><TH>Online Payments</TH></TR>
      </THead>
      <tbody>
        {accounts.map((account) => (
          <TR key={account.id}>
            <TD>{account.name}<div className="text-xs text-ink-500">{account.bank_name ?? 'Bank not provided'}</div></TD>
            <TD className="capitalize">{account.account_type?.replace(/_/g, ' ') ?? '-'}</TD>
            <TD><StatusChip tone={account.payments_enabled ? 'success' : 'neutral'}>{account.payments_enabled ? 'Enabled' : 'Disabled'}</StatusChip></TD>
          </TR>
        ))}
      </tbody>
    </Table>
  );
}

function StatusRail({ accounts }: { accounts: any[] }) {
  const enabled = accounts.filter((account) => account.payments_enabled).length;
  return (
    <div className="space-y-3 text-sm text-ink-600">
      <div className="flex items-center justify-between rounded border border-ink-100 bg-cream-50 px-3 py-2">
        <span>Enabled</span>
        <span className="font-semibold text-ink-900">{enabled}</span>
      </div>
      <div className="flex items-center justify-between rounded border border-ink-100 bg-cream-50 px-3 py-2">
        <span>Disabled</span>
        <span className="font-semibold text-ink-900">{accounts.length - enabled}</span>
      </div>
    </div>
  );
}
