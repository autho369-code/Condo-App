import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Workspace, WorkspaceHeader, Section, Tile } from '@/components/workspace/shell';
import { money, date } from '@/lib/utils';
import {
  buildBankActivityEntries,
  filterBankActivityEntries,
  summarizeBankActivity,
  withRunningBalances,
  type ActivityEntry,
  type ActivitySource,
} from '@/lib/banking/activity';

export const dynamic = 'force-dynamic';

const SOURCE_OPTIONS: Array<{ value: 'all' | ActivitySource; label: string }> = [
  { value: 'all', label: 'All activity' },
  { value: 'payment', label: 'Payments' },
  { value: 'bill', label: 'Bills' },
  { value: 'transfer', label: 'Transfers' },
  { value: 'lockbox', label: 'Lockbox' },
  { value: 'report', label: 'Reports' },
];

export default async function BankAccountActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    account_id?: string;
    source?: string;
    start?: string;
    end?: string;
    q?: string;
  }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from('bank_accounts')
    .select('id, name, bank_name, account_type, purpose, payments_enabled, auto_reconciliation, last_reconciliation_date, next_check_number, associations(name)')
    .is('archived_at', null)
    .order('name');

  const accountRows = accounts ?? [];
  const selectedAccount =
    accountRows.find((account: any) => account.id === params.account_id) ?? accountRows[0] ?? null;
  const accountId = selectedAccount?.id ?? '';

  const [{ data: payments }, { data: bills }, { data: transfers }, { data: lockboxBatches }, { data: reportRuns }] =
    accountId
      ? await Promise.all([
          supabase
            .from('payments')
            .select('id, unit_id, bank_account_id, amount, payment_date, method, reference, notes, created_at, units(id, unit_number, buildings(id, associations(id, name, operating_bank_account_id, primary_bank_account_id)))')
            .order('payment_date', { ascending: false })
            .limit(500),
          supabase
            .from('payable_bills')
            .select('id, bank_account_id, amount, bill_number, due_date, paid_at, status, memo, created_at, vendors(name), associations(id, name, operating_bank_account_id, primary_bank_account_id)')
            .is('archived_at', null)
            .order('updated_at', { ascending: false })
            .limit(500),
          supabase
            .from('bank_transfers')
            .select('id, from_bank_account_id, to_bank_account_id, amount, transfer_date, reference_number, memo, created_at, from:from_bank_account_id(name), to:to_bank_account_id(name)')
            .order('transfer_date', { ascending: false })
            .limit(500),
          supabase
            .from('lockbox_batches')
            .select('id, bank_account_id, provider, provider_batch_id, batch_date, total_items, total_amount_cents, status, deposit_reference, deposited_at, notes, created_at')
            .order('batch_date', { ascending: false })
            .limit(500),
          supabase
            .from('report_runs')
            .select('id, status, parameters, output_format, row_count, started_at, created_at, report_definitions(name, slug)')
            .order('created_at', { ascending: false })
            .limit(200),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const source = SOURCE_OPTIONS.some((option) => option.value === params.source) ? params.source : 'all';
  const allEntries = buildBankActivityEntries({
    accountId,
    payments: payments ?? [],
    bills: bills ?? [],
    transfers: transfers ?? [],
    lockboxBatches: lockboxBatches ?? [],
    reportRuns: reportRuns ?? [],
  });
  const filteredEntries = filterBankActivityEntries(allEntries, {
    accountId,
    source,
    start: params.start,
    end: params.end,
    q: params.q,
  });
  const ledger = withRunningBalances(filteredEntries);
  const summary = summarizeBankActivity(filteredEntries);
  const sourceCounts = SOURCE_OPTIONS.reduce<Record<string, number>>((counts, option) => {
    counts[option.value] = option.value === 'all'
      ? allEntries.length
      : allEntries.filter((entry) => entry.source === option.value).length;
    return counts;
  }, {});

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={<Link href="/bank-accounts" className="hover:text-brand-600">Bank Accounts</Link>}
          title="Banking Activity"
          subtitle={selectedAccount ? accountTitle(selectedAccount) : 'No bank accounts configured'}
          actions={
            <Link href="/bank-accounts">
              <Button variant="secondary" size="sm">Registry</Button>
            </Link>
          }
        />
      }
    >
      {selectedAccount ? (
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Tile label="Activity balance" value={money(summary.net)} sub={`${ledger.length} ledger rows`} tone={summary.net < 0 ? 'danger' : 'positive'} />
            <Tile label="Inflows" value={money(summary.inflow)} sub="Payments, deposits, transfers in" tone="positive" />
            <Tile label="Outflows" value={money(summary.outflow)} sub="Bills and transfers out" tone={summary.outflow > 0 ? 'warning' : 'neutral'} />
            <Tile label="Last reconciled" value={date(selectedAccount.last_reconciliation_date)} sub={selectedAccount.auto_reconciliation ? 'Auto reconciliation on' : 'Manual reconciliation'} tone="info" />
          </section>

          <Section title="Filters" padded>
            <form className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1.2fr)_150px_150px_150px_minmax(180px,1fr)_auto]" action="/bank-accounts/activity">
              <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                <span>Account</span>
                <select name="account_id" defaultValue={accountId} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm normal-case tracking-normal text-gray-900">
                  {accountRows.map((account: any) => (
                    <option key={account.id} value={account.id}>{accountTitle(account)}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                <span>Source</span>
                <select name="source" defaultValue={source} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm normal-case tracking-normal text-gray-900">
                  {SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({sourceCounts[option.value] ?? 0})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                <span>Start</span>
                <input name="start" type="date" defaultValue={params.start ?? ''} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm normal-case tracking-normal text-gray-900" />
              </label>
              <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                <span>End</span>
                <input name="end" type="date" defaultValue={params.end ?? ''} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm normal-case tracking-normal text-gray-900" />
              </label>
              <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                <span>Search</span>
                <input name="q" defaultValue={params.q ?? ''} placeholder="Memo, ref, status" className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm normal-case tracking-normal text-gray-900" />
              </label>
              <div className="flex items-end gap-2">
                <Button type="submit" size="sm" className="h-10">Apply</Button>
                <Link href={`/bank-accounts/activity?account_id=${accountId}`} className="inline-flex h-10 items-center rounded-md px-2 text-sm text-gray-600 hover:text-gray-900">Clear</Link>
              </div>
            </form>
          </Section>

          <Section
            title="Account Ledger"
            subtitle={`${ledger.length} rows scoped to ${selectedAccount.name}`}
            actions={<Link href="/reports?slug=bank-reconciliation" className="text-xs font-medium text-brand-600 hover:underline">Reconciliation report</Link>}
          >
            {ledger.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="px-5 py-2 text-left font-semibold">Date</th>
                      <th className="px-4 py-2 text-left font-semibold">Source</th>
                      <th className="px-4 py-2 text-left font-semibold">Activity</th>
                      <th className="px-4 py-2 text-left font-semibold">Reference</th>
                      <th className="px-4 py-2 text-right font-semibold">Inflow</th>
                      <th className="px-4 py-2 text-right font-semibold">Outflow</th>
                      <th className="px-5 py-2 text-right font-semibold">Running</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry) => (
                      <LedgerRow key={entry.id} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-500">No activity matches this account view.</p>
                <Link href="/bank-accounts" className="mt-2 inline-block text-sm text-brand-600 hover:underline">Back to bank account registry</Link>
              </div>
            )}
          </Section>
        </div>
      ) : (
        <Section padded>
          <div className="text-center">
            <p className="text-sm text-gray-500">No bank accounts configured yet.</p>
            <Link href="/bank-accounts/new" className="mt-2 inline-block text-sm text-brand-600 hover:underline">Create a bank account</Link>
          </div>
        </Section>
      )}
    </Workspace>
  );
}

function LedgerRow({ entry }: { entry: ActivityEntry }) {
  const inflow = entry.signedAmount > 0 ? entry.signedAmount : null;
  const outflow = entry.signedAmount < 0 ? Math.abs(entry.signedAmount) : null;

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="whitespace-nowrap px-5 py-3 text-gray-700">{date(entry.occurredOn)}</td>
      <td className="px-4 py-3"><SourcePill source={entry.source} status={entry.status} /></td>
      <td className="min-w-64 px-4 py-3">
        {entry.href ? (
          <Link href={entry.href} className="font-medium text-gray-900 hover:text-brand-600 hover:underline">{entry.description}</Link>
        ) : (
          <span className="font-medium text-gray-900">{entry.description}</span>
        )}
        <div className="mt-0.5 text-xs text-gray-500">
          {[entry.associationName, entry.counterparty, entry.memo].filter(Boolean).join(' - ') || 'No memo'}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-600">{entry.reference ?? '-'}</td>
      <td className="px-4 py-3 text-right tabular-nums font-medium text-green-700">{inflow === null ? '-' : money(inflow)}</td>
      <td className="px-4 py-3 text-right tabular-nums font-medium text-rose-700">{outflow === null ? '-' : money(outflow)}</td>
      <td className="px-5 py-3 text-right tabular-nums font-semibold text-gray-900">{money(entry.runningBalance)}</td>
    </tr>
  );
}

function SourcePill({ source, status }: { source: ActivitySource; status?: string | null }) {
  const tone: Record<ActivitySource, string> = {
    payment: 'bg-green-100 text-green-700',
    bill: 'bg-rose-100 text-rose-700',
    transfer: 'bg-blue-100 text-blue-700',
    lockbox: 'bg-emerald-100 text-emerald-700',
    report: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${tone[source]}`}>
      {source}{status ? `: ${status}` : ''}
    </span>
  );
}

function accountTitle(account: any) {
  return [
    account.associations?.name,
    account.name,
    account.bank_name,
    String(account.purpose ?? account.account_type ?? '').replace(/_/g, ' '),
  ].filter(Boolean).join(' - ');
}
