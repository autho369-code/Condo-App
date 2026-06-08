import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type TabKey = 'unreconciled' | 'reconciled';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'unreconciled', label: 'Unreconciled Items' },
  { key: 'reconciled', label: 'Reconciled Items' },
];

export default async function BankReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; tab?: string }>;
}) {
  await requireStaff();
  const { account_id = '', tab = 'unreconciled' } = await searchParams;
  const activeTab: TabKey = TABS.some((t) => t.key === tab) ? (tab as TabKey) : 'unreconciled';

  const supabase = await createClient();
  const db = supabase as any;

  // Fetch all bank accounts for the selector
  const { data: bankAccounts } = await db
    .from('bank_accounts')
    .select('id, name, bank_name, account_type, gl_account_id, last_reconciliation_date, portfolio_id')
    .is('archived_at', null)
    .order('name');

  const accounts = (bankAccounts ?? []) as any[];

  // Find the selected account
  const selectedAccount = account_id
    ? accounts.find((a: any) => a.id === account_id)
    : accounts[0] ?? null;

  // Fetch existing reconciliations for the selected account
  let reconciliations: any[] = [];
  let reconciliationItems: any[] = [];
  let journalLines: any[] = [];
  let glAccount: any = null;
  let recentReconciliation: any = null;

  if (selectedAccount) {
    // Get the GL account info
    if (selectedAccount.gl_account_id) {
      const { data: gl } = await db
        .from('gl_accounts')
        .select('id, number, name, type')
        .eq('id', selectedAccount.gl_account_id)
        .single();
      glAccount = gl;
    }

    // Fetch reconciliations for this account
    const { data: recs } = await db
      .from('bank_reconciliations')
      .select('*')
      .eq('bank_account_id', selectedAccount.id)
      .order('created_at', { ascending: false })
      .limit(20);
    reconciliations = recs ?? [];

    // Find active (in_progress) reconciliation or the most recent
    const activeReconciliation = reconciliations.find((r: any) => r.status === 'in_progress');
    const displayReconciliation =
      activeReconciliation || (activeTab === 'unreconciled' ? reconciliations[0] : null);

    if (activeTab === 'reconciled') {
      recentReconciliation = reconciliations.find((r: any) => r.status === 'completed') ?? null;
    }

    if (displayReconciliation && activeTab === 'unreconciled') {
      recentReconciliation = displayReconciliation;
    }

    // Fetch journal lines for the bank account's GL account
    if (selectedAccount.gl_account_id && recentReconciliation) {
      const { data: items } = await db
        .from('bank_reconciliation_items')
        .select('id, journal_line_id, description, amount, type, is_cleared, sort_order')
        .eq('reconciliation_id', recentReconciliation.id)
        .order('sort_order');
      reconciliationItems = items ?? [];

      const lineIds = reconciliationItems
        .filter((i: any) => i.journal_line_id)
        .map((i: any) => i.journal_line_id);

      if (lineIds.length > 0) {
        const { data: lines } = await db
          .from('journal_lines')
          .select('id, entry_id, gl_account_id, debit_amount, credit_amount, memo, journal_entries(entry_date, reference_number, description)')
          .in('id', lineIds)
          .order('id');
        journalLines = lines ?? [];
      }
    }
  }

  // Build display items: merge reconciliation items with journal line data
  const displayItems = reconciliationItems.map((item: any) => {
    const line = journalLines.find((l: any) => l.id === item.journal_line_id);
    const amount = line
      ? (line.debit_amount ?? 0) - (line.credit_amount ?? 0)
      : item.amount;
    const entryDate = line?.journal_entries?.entry_date ?? null;
    const refNumber = line?.journal_entries?.reference_number ?? null;
    const description = item.description || line?.journal_entries?.description || line?.memo || '—';

    return {
      id: item.id,
      journalLineId: item.journal_line_id,
      description,
      amount,
      type: item.type,
      isCleared: item.is_cleared,
      entryDate,
      refNumber,
    };
  });

  // Metrics
  const totalBookItems = displayItems.length;
  const clearedItems = displayItems.filter((i: any) => i.isCleared).length;
  const clearedAmount = displayItems
    .filter((i: any) => i.isCleared)
    .reduce((sum: number, i: any) => sum + (i.amount ?? 0), 0);
  const outstandingAmount = displayItems
    .filter((i: any) => !i.isCleared)
    .reduce((sum: number, i: any) => sum + (i.amount ?? 0), 0);

  const totalBookAmount = displayItems.reduce((sum: number, i: any) => sum + (i.amount ?? 0), 0);
  const statementBalance = recentReconciliation?.statement_balance ?? 0;
  const adjustedBookBalance = totalBookAmount - outstandingAmount;

  return (
    <DataWorkspace
      title="Bank Reconciliation"
      description="Match bank statement transactions against your general ledger. Clear items, track outstanding checks and deposits, and reconcile differences."
      rail={<ReconcileRail selectedAccountId={selectedAccount?.id} />}
    >
      <div className="space-y-6">
        {/* Bank account selector */}
        <div className="rounded border border-gray-200 bg-white p-4">
          <label className="text-xs font-medium uppercase text-gray-500">Bank Account</label>
          <form method="get" action="/bank-accounts/reconcile" className="mt-1 flex gap-3">
            <select
              name="account_id"
              defaultValue={selectedAccount?.id ?? ''}
              className="h-10 flex-1 rounded border border-gray-300 bg-white px-3 text-sm text-gray-900"
            >
              {accounts.length === 0 && (
                <option value="">No bank accounts available</option>
              )}
              {accounts.map((account: any) => (
                <option key={account.id} value={account.id}>
                  {account.name} {account.bank_name ? `(${account.bank_name})` : ''}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Select Account
            </button>
          </form>
        </div>

        {!selectedAccount ? (
          <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <p className="text-sm text-gray-500">
              Select a bank account above to begin reconciliation.
            </p>
          </div>
        ) : (
          <>
            {/* Metrics strip */}
            <MetricStrip
              metrics={[
                {
                  label: 'Statement Balance',
                  value: money(statementBalance),
                  sublabel: recentReconciliation ? date(recentReconciliation.statement_date) : 'No statement entered',
                },
                {
                  label: 'Book Balance (GL)',
                  value: money(totalBookAmount),
                  sublabel: `${totalBookItems} journal entries`,
                },
                {
                  label: 'Cleared',
                  value: `${clearedItems}/${totalBookItems}`,
                  sublabel: `${money(clearedAmount)} matched`,
                },
                {
                  label: 'Difference',
                  value: money(adjustedBookBalance - statementBalance),
                  sublabel: adjustedBookBalance === statementBalance ? 'RECONCILED' : 'Out of balance',
                },
              ]}
            />

            {/* Bank Account Info Bar */}
            <div className="flex flex-wrap gap-4 rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <div>
                <span className="text-gray-500">Account: </span>
                <span className="font-medium text-gray-900">{selectedAccount.name}</span>
              </div>
              {selectedAccount.bank_name && (
                <div>
                  <span className="text-gray-500">Bank: </span>
                  <span className="font-medium text-gray-900">{selectedAccount.bank_name}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Type: </span>
                <span className="font-medium capitalize text-gray-900">
                  {selectedAccount.account_type?.replace(/_/g, ' ') ?? '—'}
                </span>
              </div>
              {glAccount && (
                <div>
                  <span className="text-gray-500">GL: </span>
                  <span className="font-medium text-gray-900">
                    {glAccount.number} — {glAccount.name}
                  </span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Last reconciled: </span>
                <span className="font-medium text-gray-900">
                  {date(selectedAccount.last_reconciliation_date)}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <nav className="flex gap-1 border-b border-gray-200">
              {TABS.map(({ key, label }) => {
                const isActive = activeTab === key;
                const searchAccountId = selectedAccount?.id ?? '';
                const href = `/bank-accounts/reconcile?account_id=${encodeURIComponent(searchAccountId)}&tab=${key}`;
                return (
                  <Link
                    key={key}
                    href={href}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-b-2 border-gray-950 text-gray-950'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Statement info (for unreconciled tab) */}
            {activeTab === 'unreconciled' && recentReconciliation && (
              <div className="rounded border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Reconciliation — {date(recentReconciliation.statement_date, 'long')}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Statement Balance: {money(recentReconciliation.statement_balance)}
                      {' · '}
                      Status:{' '}
                      <StatusChip tone={recentReconciliation.status === 'completed' ? 'success' : 'warning'}>
                        {recentReconciliation.status === 'in_progress' ? 'In Progress' : 'Completed'}
                      </StatusChip>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {recentReconciliation.status === 'in_progress' && (
                      <form
                        action="/api/bank-reconciliation/complete"
                        method="post"
                      >
                        <input type="hidden" name="reconciliation_id" value={recentReconciliation.id} />
                        <button
                          type="submit"
                          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                        >
                          Complete Reconciliation
                        </button>
                      </form>
                    )}
                    <Link
                      href={`/bank-accounts/reconcile/new?account_id=${encodeURIComponent(selectedAccount.id)}`}
                      className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      New Reconciliation
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {!recentReconciliation && (
              <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
                <p className="text-sm text-gray-500">
                  No reconciliation found for this bank account.
                </p>
                <Link
                  href={`/bank-accounts/reconcile/new?account_id=${encodeURIComponent(selectedAccount.id)}`}
                  className="mt-3 inline-block rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Start New Reconciliation
                </Link>
              </div>
            )}

            {/* Display items table */}
            {recentReconciliation && displayItems.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH className="w-12">Cleared</TH>
                    <TH>Date</TH>
                    <TH>Description</TH>
                    <TH>Reference #</TH>
                    <TH>Type</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <tbody>
                  {displayItems.map((item: any) => (
                    <TR key={item.id} className="hover:bg-gray-50">
                      <TD>
                        <form
                          action={`/api/bank-reconciliation/toggle-cleared`}
                          method="post"
                        >
                          <input type="hidden" name="item_id" value={item.id} />
                          <input type="hidden" name="reconciliation_id" value={recentReconciliation.id} />
                          <input type="hidden" name="account_id" value={selectedAccount.id} />
                          <input type="hidden" name="tab" value={activeTab} />
                          <button type="submit" className="flex h-6 w-6 items-center justify-center">
                            {item.isCleared ? (
                              <svg className="h-5 w-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            ) : (
                              <svg className="h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>
                        </form>
                      </TD>
                      <TD className="whitespace-nowrap text-sm">{date(item.entryDate)}</TD>
                      <TD className="max-w-xs">
                        <div className="text-sm text-gray-900">{item.description}</div>
                      </TD>
                      <TD className="font-mono text-xs text-gray-500">{item.refNumber ?? '—'}</TD>
                      <TD>
                        <StatusChip tone={item.type === 'bank_only' ? 'info' : 'neutral'}>
                          {item.type === 'bank_only' ? 'Bank Only' : 'Book'}
                        </StatusChip>
                      </TD>
                      <TD className="text-right tabular-nums font-medium">
                        <span className={item.amount >= 0 ? 'text-gray-900' : 'text-red-600'}>
                          {money(item.amount)}
                        </span>
                      </TD>
                      <TD>
                        <StatusChip tone={item.isCleared ? 'success' : 'warning'}>
                          {item.isCleared ? 'Cleared' : 'Outstanding'}
                        </StatusChip>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : recentReconciliation ? (
              <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
                <p className="text-sm text-gray-500">
                  No journal entries have been added to this reconciliation yet.
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Journal entries that post to GL account {glAccount?.number} will appear here for matching.
                </p>
              </div>
            ) : null}

            {/* Summary footer */}
            {recentReconciliation && displayItems.length > 0 && (
              <div className="rounded border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Reconciliation Summary</h3>
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-gray-500">Statement Balance</div>
                    <div className="font-mono font-medium">{money(statementBalance)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total Book Items</div>
                    <div className="font-mono font-medium">{money(totalBookAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Less: Outstanding</div>
                    <div className="font-mono font-medium text-amber-700">({money(outstandingAmount)})</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Adjusted Book Balance</div>
                    <div className="font-mono font-medium">{money(adjustedBookBalance)}</div>
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <div className="mt-2 border-t border-gray-200 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Difference:</span>
                        <span
                          className={`font-mono text-lg font-bold ${
                            Math.abs(adjustedBookBalance - statementBalance) < 0.01
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {money(adjustedBookBalance - statementBalance)}
                        </span>
                        {Math.abs(adjustedBookBalance - statementBalance) < 0.01 && (
                          <StatusChip tone="success">RECONCILED</StatusChip>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DataWorkspace>
  );
}

function ReconcileRail({ selectedAccountId }: { selectedAccountId?: string }) {
  const accountParam = selectedAccountId ? `?account_id=${encodeURIComponent(selectedAccountId)}` : '';
  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-gray-950">Reconciliation Tasks</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href={`/bank-accounts/reconcile/new${accountParam ? accountParam : ''}`} label="New Reconciliation" />
          <RailLink
            href={`/bank-accounts/reconcile${accountParam ? `${accountParam}&tab=reconciled` : '?tab=reconciled'}`}
            label="View Completed Reconciliations"
          />
          <RailLink
            href={`/bank-accounts/reconcile${accountParam ? `${accountParam}&tab=unreconciled` : ''}`}
            label="View In-Progress Reconciliations"
          />
        </div>
      </section>
      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Banking</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/bank-accounts" label="Bank Accounts" />
          <RailLink href="/bank-transfers" label="Bank Transfers" />
          <RailLink href="/bank-accounts/feeds" label="Bank Feed" />
          <RailLink href="/gl-accounts" label="GL Accounts" />
          <RailLink href="/journal-entries" label="Journal Entries" />
        </div>
      </section>
      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Reports</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/reports/balance_sheet" label="Balance Sheet" />
          <RailLink href="/reports/general_ledger" label="General Ledger" />
          <RailLink href="/reports/trial_balance" label="Trial Balance" />
        </div>
      </section>
    </div>
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
