import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { updateBankAccountLinking } from '@/lib/rpcs/entities';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function LinkBankAccountPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: accounts } = await (supabase as any)
    .from('bank_accounts')
    .select('id, name, bank_name, auto_reconciliation, last_reconciliation_date')
    .is('archived_at', null)
    .order('name');

  return (
    <DataWorkspace
      title="Link With Bank"
      description=""
      actions={<Link href="/bank-accounts" className="text-sm font-medium text-ink-600 hover:text-ink-900">Back to Bank Accounts</Link>}
      rail={<LinkRail accounts={accounts ?? []} />}
    >
      <div className="space-y-5">
        <form action={updateBankAccountLinking} className="rounded border border-ink-100 bg-white p-5">
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
              Link Status
              <select name="auto_reconciliation" defaultValue="true" className="mt-1 h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm text-ink-900">
                <option value="true">Linked</option>
                <option value="false">Unlinked</option>
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit">Save</Button>
            </div>
          </div>
        </form>

        {accounts && accounts.length > 0 ? (
          <Table>
            <THead>
              <TR><TH>Account</TH><TH>Feed Status</TH><TH>Last Reconciliation</TH></TR>
            </THead>
            <tbody>
              {accounts.map((account: any) => (
                <TR key={account.id}>
                  <TD>{account.name}<div className="text-xs text-ink-500">{account.bank_name ?? 'Bank not provided'}</div></TD>
                  <TD><StatusChip tone={account.auto_reconciliation ? 'success' : 'warning'}>{account.auto_reconciliation ? 'Linked' : 'Unlinked'}</StatusChip></TD>
                  <TD>{date(account.last_reconciliation_date)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="rounded border border-dashed border-ink-200 bg-white px-6 py-10 text-center text-sm text-ink-500">No bank accounts found.</p>
        )}
      </div>
    </DataWorkspace>
  );
}

function LinkRail({ accounts }: { accounts: any[] }) {
  const linked = accounts.filter((account) => account.auto_reconciliation).length;
  return (
    <div className="space-y-3 text-sm text-ink-600">
      <div className="flex items-center justify-between rounded border border-ink-100 bg-cream-50 px-3 py-2">
        <span>Linked</span>
        <span className="font-semibold text-ink-900">{linked}</span>
      </div>
      <div className="flex items-center justify-between rounded border border-ink-100 bg-cream-50 px-3 py-2">
        <span>Unlinked</span>
        <span className="font-semibold text-ink-900">{accounts.length - linked}</span>
      </div>
    </div>
  );
}
