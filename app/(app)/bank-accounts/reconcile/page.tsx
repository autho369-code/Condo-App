import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import {
  buildReconciliationTransactions,
  calculateReconciliationSummary,
  getReconciliationGuardrails,
  parseStatementBalance,
  type ReconciliationTransaction,
} from '@/lib/banking/reconciliation';
import { reconcileBankAccount } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type ReconcileSearchParams = {
  bank_account_id?: string;
  statement_date?: string;
  statement_balance?: string;
  reconciled?: string;
};

export default async function BankReconcilePage({
  searchParams,
}: {
  searchParams: Promise<ReconcileSearchParams>;
}) {
  await requireStaff();
  const params = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: accountRows } = await db
    .from('bank_accounts')
    .select('id, name, bank_name, account_type, payments_enabled, auto_reconciliation, last_reconciliation_date, associations!bank_accounts_association_id_fkey(name)')
    .is('archived_at', null)
    .order('name');

  const accounts = accountRows ?? [];
  const selectedAccountId = params.bank_account_id || accounts[0]?.id || '';
  const selectedAccount = accounts.find((account: any) => account.id === selectedAccountId);
  const statementDate = params.statement_date || '';
  const statementBalance = parseStatementBalance(params.statement_balance);

  const [paymentResult, billResult, transferResult] = selectedAccountId
    ? await Promise.all([
        db
          .from('payments')
          .select('id, amount, payment_date, method, reference, notes')
          .eq('bank_account_id', selectedAccountId)
          .order('payment_date', { ascending: true })
          .limit(250),
        db
          .from('payable_bills')
          .select('id, amount, paid_at, due_date, bill_number, memo, vendors(name)')
          .eq('bank_account_id', selectedAccountId)
          .eq('status', 'paid')
          .is('archived_at', null)
          .order('paid_at', { ascending: true, nullsFirst: false })
          .limit(250),
        db
          .from('bank_transfers')
          .select('id, amount, transfer_date, reference_number, memo, from_bank_account_id, to_bank_account_id, from:from_bank_account_id(name), to:to_bank_account_id(name)')
          .or(`from_bank_account_id.eq.${selectedAccountId},to_bank_account_id.eq.${selectedAccountId}`)
          .order('transfer_date', { ascending: true })
          .limit(250),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const transactions = buildReconciliationTransactions({
    bankAccountId: selectedAccountId,
    payments: paymentResult.data ?? [],
    payableBills: billResult.data ?? [],
    transfers: transferResult.data ?? [],
  });

  const summary = calculateReconciliationSummary({
    statementDate,
    statementBalance: statementBalance ?? 0,
    transactions,
  });

  const guardrails = getReconciliationGuardrails({
    hasAccount: Boolean(selectedAccountId),
    statementDate,
    statementBalance,
    summary,
  });
  const hasStatementInputs = Boolean(statementDate) && statementBalance !== null;

  return (
    <DataWorkspace
      title="Bank reconciliation"
      description="Match a statement balance to cleared payments, bill payments, and transfers before updating the account reconciliation date."
      rail={<ReconciliationRail account={selectedAccount} summary={summary} guardrails={guardrails} />}
    >
      <div className="space-y-6">
        {params.reconciled === '1' && (
          <div className="rounded border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-900">
            Bank account reconciled through {date(statementDate)}.
          </div>
        )}

        <form action="/bank-accounts/reconcile" className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(160px,1fr)_minmax(160px,1fr)_auto]">
            <label className="text-sm font-medium text-ink-700">
              Account
              <select
                name="bank_account_id"
                defaultValue={selectedAccountId}
                className="mt-1 h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm text-ink-900"
              >
                {accounts.length === 0 && <option value="">No active accounts</option>}
                {accounts.map((account: any) => (
                  <option key={account.id} value={account.id}>
                    {account.name}{account.bank_name ? ` - ${account.bank_name}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-ink-700">
              Statement date
              <input
                type="date"
                name="statement_date"
                defaultValue={statementDate}
                className="mt-1 h-10 w-full rounded border border-ink-200 px-3 text-sm text-ink-900"
              />
            </label>
            <label className="text-sm font-medium text-ink-700">
              Ending balance
              <input
                name="statement_balance"
                defaultValue={params.statement_balance ?? ''}
                placeholder="$0.00"
                className="mt-1 h-10 w-full rounded border border-ink-200 px-3 text-sm text-ink-900"
              />
            </label>
            <div className="flex items-end">
              <Button type="submit" variant="secondary" className="w-full lg:w-auto">Refresh</Button>
            </div>
          </div>
          {selectedAccount && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <StatusChip tone={selectedAccount.auto_reconciliation ? 'info' : 'neutral'}>
                {selectedAccount.auto_reconciliation ? 'Feed assisted' : 'Manual'}
              </StatusChip>
              <span>{selectedAccount.associations?.name ?? 'Portfolio-level account'}</span>
              <span>Last reconciled {date(selectedAccount.last_reconciliation_date)}</span>
            </div>
          )}
        </form>

        <MetricStrip
          metrics={[
            { label: 'Statement balance', value: money(statementBalance), sublabel: date(statementDate) },
            { label: 'Cleared balance', value: money(summary.clearedBalance), sublabel: `${summary.cleared.length} cleared transactions` },
            { label: 'Book balance', value: money(summary.bookBalance), sublabel: 'Payments, bills, and transfers' },
            {
              label: 'Over-under',
              value: hasStatementInputs ? money(summary.difference) : '—',
              sublabel: hasStatementInputs ? summary.differenceLabel : 'Awaiting statement inputs',
              tone: summary.difference === 0 && hasStatementInputs ? 'positive' : 'warning',
            },
          ]}
        />

        <section className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <BalanceTile label="Uncleared deposits" value={money(summary.unclearedDeposits)} />
            <BalanceTile label="Uncleared withdrawals" value={money(summary.unclearedWithdrawals)} />
            <BalanceTile label="Adjusted statement" value={hasStatementInputs ? money(summary.adjustedStatementBalance) : '—'} />
            <BalanceTile label="Difference" value={hasStatementInputs ? money(summary.difference) : '—'} tone={summary.difference === 0 && hasStatementInputs ? 'balanced' : 'open'} />
          </div>
        </section>

        <GuardrailPanel guardrails={guardrails} statementBalance={statementBalance} />

        <TransactionTable title="Cleared transactions" rows={summary.cleared} empty="No transactions are cleared through this statement date." />
        <TransactionTable title="Uncleared transactions" rows={summary.uncleared} empty="No outstanding deposits, bill payments, or transfers remain after this statement date." />

        <form action={reconcileBankAccount} className="flex flex-wrap justify-end gap-2">
          <input type="hidden" name="bank_account_id" value={selectedAccountId} />
          <input type="hidden" name="statement_date" value={statementDate} />
          <input type="hidden" name="statement_balance" value={params.statement_balance ?? ''} />
          <Button type="button" variant="secondary" disabled={!guardrails.canSaveDraft}>Save draft</Button>
          <Button type="submit" disabled={!guardrails.canReconcile}>Reconcile account</Button>
        </form>
      </div>
    </DataWorkspace>
  );
}

function BalanceTile({ label, value, tone }: { label: string; value: string; tone?: 'balanced' | 'open' }) {
  return (
    <div className="rounded border border-ink-100 bg-cream-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">{label}</div>
      <div className={`mt-2 text-xl font-semibold tabular-nums ${tone === 'balanced' ? 'text-sage-700' : tone === 'open' ? 'text-champagne-700' : 'text-ink-900'}`}>
        {value}
      </div>
    </div>
  );
}

function GuardrailPanel({
  guardrails,
  statementBalance,
}: {
  guardrails: { canSaveDraft: boolean; canReconcile: boolean; blockers: string[] };
  statementBalance: number | null;
}) {
  const items = guardrails.blockers.length > 0
    ? guardrails.blockers
    : ['Ready to reconcile. The adjusted statement balance matches the book balance.'];

  return (
    <section className={`rounded-lg border p-5 shadow-soft-sm ${guardrails.canReconcile ? 'border-sage-200 bg-sage-50' : 'border-champagne-200 bg-champagne-50'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">Save and reconcile guardrails</h2>
          <p className="mt-1 text-xs text-ink-600">
            Draft save requires account, statement date, and ending balance. Reconcile unlocks only when the difference is zero.
          </p>
        </div>
        <div className="flex gap-2">
          <StatusChip tone={guardrails.canSaveDraft ? 'success' : 'warning'}>{guardrails.canSaveDraft ? 'Draft ready' : 'Draft blocked'}</StatusChip>
          <StatusChip tone={guardrails.canReconcile ? 'success' : 'warning'}>{guardrails.canReconcile ? 'Reconcile ready' : 'Reconcile blocked'}</StatusChip>
        </div>
      </div>
      <ul className="mt-4 grid gap-2 text-sm text-ink-700">
        {items.map((item) => (
          <li key={item} className="rounded border border-white/60 bg-white/70 px-3 py-2">{item}</li>
        ))}
        {statementBalance === null && (
          <li className="rounded border border-white/60 bg-white/70 px-3 py-2">Use the ending balance printed on the bank statement, not the current bank feed balance.</li>
        )}
      </ul>
    </section>
  );
}

function TransactionTable({ title, rows, empty }: { title: string; rows: ReconciliationTransaction[]; empty: string }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        <span className="text-xs font-medium text-ink-500">{rows.length} rows</span>
      </div>
      {rows.length > 0 ? (
        <Table>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Type</TH>
              <TH>Description</TH>
              <TH>Reference</TH>
              <TH className="text-right">Deposit</TH>
              <TH className="text-right">Withdrawal</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((row) => (
              <TR key={row.id}>
                <TD className="whitespace-nowrap">{date(row.date)}</TD>
                <TD>{row.type}</TD>
                <TD>{row.description}</TD>
                <TD className="font-mono text-xs text-ink-600">{row.reference}</TD>
                <TD className="text-right">{row.amount > 0 ? money(row.amount) : '-'}</TD>
                <TD className="text-right">{row.amount < 0 ? money(Math.abs(row.amount)) : '-'}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="rounded-lg border border-dashed border-ink-200 bg-white px-6 py-10 text-center text-sm text-ink-500">{empty}</p>
      )}
    </section>
  );
}

function ReconciliationRail({
  account,
  summary,
  guardrails,
}: {
  account: any;
  summary: ReturnType<typeof calculateReconciliationSummary>;
  guardrails: { canSaveDraft: boolean; canReconcile: boolean; blockers: string[] };
}) {
  return (
    <div className="space-y-5 text-sm text-ink-600">
      <section>
        <h2 className="text-sm font-semibold text-ink-900">Statement scope</h2>
        {account ? (
          <dl className="mt-3 space-y-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Account</dt>
              <dd className="mt-1 font-medium text-ink-900">{account.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Bank</dt>
              <dd className="mt-1">{account.bank_name ?? 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Last reconciled</dt>
              <dd className="mt-1">{date(account.last_reconciliation_date)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3">Create or select an active bank account to begin.</p>
        )}
      </section>

      <section className="border-t border-ink-100 pt-5">
        <h2 className="text-sm font-semibold text-ink-900">Outstanding after statement</h2>
        <div className="mt-3 grid gap-2">
          <RailMetric label="Deposits" value={money(summary.unclearedDeposits)} />
          <RailMetric label="Withdrawals" value={money(summary.unclearedWithdrawals)} />
          <RailMetric label="Rows" value={String(summary.uncleared.length)} />
        </div>
      </section>

      <section className="border-t border-ink-100 pt-5">
        <h2 className="text-sm font-semibold text-ink-900">Next actions</h2>
        <div className="mt-3 grid gap-2">
          <Link href="/bank-accounts/activity" className="rounded border border-ink-100 px-3 py-2 font-medium text-ink-700 hover:bg-cream-50">Review activity</Link>
          <Link href="/bank-accounts/adjustments/new" className="rounded border border-ink-100 px-3 py-2 font-medium text-ink-700 hover:bg-cream-50">Add adjustment</Link>
          <Link href="/reports/bank_reconciliation" className="rounded border border-ink-100 px-3 py-2 font-medium text-ink-700 hover:bg-cream-50">Reconciliation report</Link>
        </div>
      </section>

      {!guardrails.canReconcile && (
        <section className="rounded border border-champagne-200 bg-champagne-50 p-3 text-xs leading-5 text-champagne-900">
          Reconcile stays locked while required inputs are missing or the over-under difference is open.
        </section>
      )}
    </div>
  );
}

function RailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-ink-100 bg-cream-50 px-3 py-2">
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-ink-900">{value}</span>
    </div>
  );
}
