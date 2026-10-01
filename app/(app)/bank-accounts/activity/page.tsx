import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Landmark } from 'lucide-react';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { toActivityRows, type BankActivitySourceRow } from '@/lib/banking/activity';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { journalLineTotals } from '@/lib/finance/totals';

export const dynamic = 'force-dynamic';

export default async function BankActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ bank_account_id?: string; from?: string; to?: string; q?: string }>;
}) {
  await requireStaff();
  const { bank_account_id = '', from = '', to = '', q: search = '' } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: accounts } = await db
    .from('bank_accounts')
    .select('id, name, bank_name, gl_account_id, association_id')
    .is('archived_at', null)
    .order('name');

  const accountList = (accounts ?? []) as any[];

  // Resolve the account whose ledger we display. Default to the first account
  // that is linked to a GL account so activity can actually be computed.
  const selectedAccount = bank_account_id
    ? accountList.find((a) => a.id === bank_account_id)
    : accountList.find((a) => a.gl_account_id) ?? accountList[0];

  let sourceRows: BankActivitySourceRow[] = [];
  let openingBalance = 0;
  let tooMany = false;
  let loadError: string | null = null;

  if (selectedAccount?.gl_account_id) {
    // Every posted line in the period for this bank's association (several
    // associations' banks can share one cash GL account), paged past the
    // 1,000-row cap; the totals and running balance cover all of them.
    const { rows: lines, truncated, error: linesError } = await fetchAllRows<any>(() => {
      let q = db
        .from('journal_lines')
        .select(
          'id, debit_amount, credit_amount, memo, journal_entries!inner(entry_date, reference_number, description, posted)',
        )
        .eq('gl_account_id', selectedAccount.gl_account_id)
        // Drafts are not cash movements (the reports filter posted too).
        .eq('journal_entries.posted', true);
      if (selectedAccount.association_id) q = q.eq('association_id', selectedAccount.association_id);
      if (from) q = q.gte('journal_entries.entry_date', from);
      if (to) q = q.lte('journal_entries.entry_date', to);
      return q.order('id');
    }, { maxRows: 20000 });
    // A partial set (cut off in id order, not by date) would give wrong
    // totals and balances, so ask for a narrower range instead.
    tooMany = truncated;
    loadError = linesError;

    // Balance before the period, so running balances are real balances.
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      const [y, m, d] = from.split('-').map(Number);
      const dayBefore = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
      const totals = await journalLineTotals(db, {
        glAccountIds: [selectedAccount.gl_account_id],
        associationIds: selectedAccount.association_id ? [selectedAccount.association_id] : null,
        to: dayBefore,
      });
      openingBalance = totals.reduce((sum, t) => sum + t.debit_total - t.credit_total, 0);
    }

    sourceRows = (tooMany ? [] : (lines ?? []) as any[]).map((line) => {
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

  // Apply the search box (payee/memo/reference) before computing period totals.
  const needle = search.trim().toLowerCase();
  if (needle) {
    sourceRows = sourceRows.filter((r) =>
      [r.payee, r.description, r.reference].some((v) => v?.toLowerCase().includes(needle)),
    );
  }
  // With a search the rows are a subset, so balances are shown from the
  // opening balance over the matching lines only.
  const rows = toActivityRows(sourceRows, openingBalance);
  // The table shows the latest 1,000 lines; totals above cover the whole period.
  const shownRows = rows.slice(-1000);

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
          { label: 'Net change (period)', value: money(rows.reduce((sum, row) => sum + row.cashIn - row.cashOut, 0)) },
        ]} />

        {loadError && <Alert title="Could not load account activity.">{loadError}</Alert>}
        {tooMany && (
          <Alert title="Too many transactions to show.">
            This account has more than 20,000 ledger lines in the selected period. Choose a shorter date range.
          </Alert>
        )}

        <FilterBar action="/bank-accounts/activity" searchDefault={search} searchPlaceholder="Search payee or memo">
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
              {shownRows.map((row) => (
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
