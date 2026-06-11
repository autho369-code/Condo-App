import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { toActivityRows } from '@/lib/banking/activity';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BankActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ bank_account_id?: string; from?: string; to?: string }>;
}) {
  await requireStaff();
  const { bank_account_id = '', from = '', to = '' } = await searchParams;
  const supabase = await createClient();
  const { data: accounts } = await (supabase as any)
    .from('bank_accounts')
    .select('id, name, bank_name')
    .is('archived_at', null)
    .order('name');

  const rows = toActivityRows([
    { id: 'opening', date: from || '2026-04-01', payee: 'Opening balance', transactionType: 'balance', reference: '-', cleared: true, cashIn: 0, cashOut: 0, description: 'Starting point' },
  ], 0);

  return (
    <DataWorkspace
      title="Bank account activity"
      description="Review account movement with date and account filters before exporting the formal report."
    >
      <div className="space-y-6">
        <MetricStrip metrics={[
          { label: 'Transactions', value: rows.length, sublabel: 'Current preview' },
          { label: 'Cash in', value: money(rows.reduce((sum, row) => sum + row.cashIn, 0)) },
          { label: 'Cash out', value: money(rows.reduce((sum, row) => sum + row.cashOut, 0)) },
          { label: 'Ending balance', value: money(rows.at(-1)?.runningBalance ?? 0) },
        ]} />

        <FilterBar action="/bank-accounts/activity" searchPlaceholder="Search payee or memo">
          <FilterSelect label="Account" name="bank_account_id" defaultValue={bank_account_id}>
            <option value="">All accounts</option>
            {(accounts ?? []).map((account: any) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </FilterSelect>
          <label className="text-[12px] font-medium text-gray-500">
            From
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="mt-1 block h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </label>
          <label className="text-[12px] font-medium text-gray-500">
            To
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="mt-1 block h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </label>
        </FilterBar>

        <Table>
          <THead><TR><TH>Date</TH><TH>Payee</TH><TH>Type</TH><TH>Reference</TH><TH className="text-right">Cash in</TH><TH className="text-right">Cash out</TH><TH className="text-right">Balance</TH></TR></THead>
          <tbody>
            {rows.map((row) => (
              <TR key={row.id}>
                <TD>{date(row.date)}</TD>
                <TD>{row.payee ?? row.description}</TD>
                <TD className="capitalize">{row.transactionType}</TD>
                <TD>{row.reference}</TD>
                <TD className="text-right tabular-nums">{row.cashIn ? money(row.cashIn) : '—'}</TD>
                <TD className="text-right tabular-nums">{row.cashOut ? money(row.cashOut) : '—'}</TD>
                <TD className="text-right tabular-nums font-medium">{money(row.runningBalance)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
