import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { EmptyState } from '@/components/ui/shell';
import { Landmark } from 'lucide-react';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { toActivityRows, type BankActivitySourceRow } from '@/lib/banking/activity';
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
  const db = supabase as any;

  const { data: accounts } = await db
    .from('bank_accounts')
    .select('id, name, bank_name, gl_account_id')
    .is('archived_at', null)
    .order('name');

  const accountList = (accounts ?? []) as any[];

  // Resolve the account whose ledger we display. Default to the first account
  // that is linked to a GL account so activity can actually be computed.
  const selectedAccount = bank_account_id
    ? accountList.find((a) => a.id === bank_account_id)
    : accountList.find((a) => a.gl_account_id) ?? accountList[0];

  let sourceRows: BankActivitySourceRow[] = [];

  if (selectedAccount?.gl_account_id) {
    let q = db
      .from('journal_lines')
      .select(
        'id, debit_amount, credit_amount, memo, journal_entries!inner(entry_date, reference_number, description)',
      )
      .eq('gl_account_id', selectedAccount.gl_account_id);

    if (from) q = q.gte('journal_entries.entry_date', from);
    if (to) q = q.lte('journal_entries.entry_date', to);

    const { data: lines } = await q.limit(500);

    sourceRows = ((lines ?? []) as any[]).map((line) => {
      const debit = Number(line.debit_amount ?? 0);
      const credit = Number(line.credit_amount ?? 0);
      const je = line.journal_entries;
      return {
        id: line.id,
        date: je?.entry_date ?? '',
        payee: je?.description ?? line.memo ?? 'Journal entry',
        transactionType: debit >= credit ? 'deposit' : 'withdrawal',
        reference: je?.reference_number ?? '—',
        cleared: true,
        // For a cash/asset GL account, debit increases cash, credit decreases it.
        cashIn: debit,
        cashOut: credit,
        description: je?.description ?? line.memo ?? '',
      } satisfies BankActivitySourceRow;
    });
  }

  const rows = toActivityRows(sourceRows, 0);

  return (
    <DataWorkspace
      title="Bank account activity"
      description="Review account movement with date and account filters before exporting the formal report."
    >
      <div className="space-y-6">
        <MetricStrip metrics={[
          { label: 'Transactions', value: rows.length, sublabel: selectedAccount?.name ?? 'No account selected' },
          { label: 'Cash in', value: money(rows.reduce((sum, row) => sum + row.cashIn, 0)) },
          { label: 'Cash out', value: money(rows.reduce((sum, row) => sum + row.cashOut, 0)) },
          { label: 'Ending balance', value: money(rows.at(-1)?.runningBalance ?? 0) },
        ]} />

        <FilterBar action="/bank-accounts/activity" searchPlaceholder="Search payee or memo">
          <FilterSelect label="Account" name="bank_account_id" defaultValue={selectedAccount?.id ?? bank_account_id}>
            {accountList.length === 0 && <option value="">No bank accounts</option>}
            {accountList.map((account: any) => <option key={account.id} value={account.id}>{account.name}</option>)}
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

        {rows.length > 0 ? (
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
        ) : (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={Landmark}
              title="No activity in this view"
              description={
                selectedAccount
                  ? selectedAccount.gl_account_id
                    ? 'No general ledger activity matched the selected account and date range.'
                    : 'This bank account is not linked to a general ledger account, so activity cannot be shown.'
                  : 'Select a bank account to review its movement.'
              }
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
