import { AccountingPage } from '@/components/accounting/accounting-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BankTransfersPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('bank_transfers')
    .select(`id, amount, transfer_date, reference_number, memo,
             from:from_bank_account_id(name), to:to_bank_account_id(name)`)
    .order('transfer_date', { ascending: false })
    .limit(100);

  return (
    <AccountingPage
      active="bank-transfers"
      title="Incomplete Transfers"
      subtabs={[
        { label: 'Incomplete Transfers', href: '/bank-transfers', active: true },
        { label: 'Completed Transfers', href: '/bank-transfers?status=completed' },
      ]}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <a href="/bank-transfers/new" className="border border-ink-900 bg-white px-3 py-1.5 text-xs text-ink-900">Transfer Individually</a>
          <a href="/bank-transfers/new?mode=group" className="border border-ink-900 bg-white px-3 py-1.5 text-xs text-ink-900">Transfer as Group</a>
        </div>

        <form action="/bank-transfers" className="bg-ink-100 px-3 py-2">
          <input
            name="q"
            placeholder="Search by Bank Name and Association Name"
            className="h-8 w-80 max-w-full border border-ink-300 bg-white px-2 text-xs text-ink-900"
          />
        </form>

        {rows && rows.length > 0 ? (
          <Table>
            <THead>
              <TR><TH>From</TH><TH></TH><TH>To</TH><TH>Created</TH><TH className="text-right">Amount</TH><TH>Status</TH></TR>
            </THead>
            <tbody>
              {rows.map((transfer: any) => (
                <TR key={transfer.id}>
                  <TD className="font-medium text-ink-900">{transfer.from?.name ?? 'Source account'}</TD>
                  <TD className="text-center text-brand-700">-&gt;</TD>
                  <TD className="font-medium text-ink-900">{transfer.to?.name ?? 'Destination account'}</TD>
                  <TD className="whitespace-nowrap text-sm">{date(transfer.transfer_date)}</TD>
                  <TD className="text-right tabular-nums font-medium">{money(transfer.amount)}</TD>
                  <TD><span className="bg-ink-100 px-2 py-0.5 text-[10px] font-medium uppercase text-ink-700">Incomplete</span></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">No transfers found.</p>
        )}
      </div>
    </AccountingPage>
  );
}
