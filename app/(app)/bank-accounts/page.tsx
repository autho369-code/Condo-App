import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
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
  const unreconciled = accounts.filter((row: any) => !row.last_reconciliation_date).length;
  const paymentsEnabled = accounts.filter((row: any) => row.payments_enabled).length;
  const autoRec = accounts.filter((row: any) => row.auto_reconciliation).length;

  return (
    <DataWorkspace
      title={filter === 'unreconciled' ? 'Unreconciled bank accounts' : 'Bank accounts'}
      description="Operating, reserve, and trust accounts with reconciliation, deposits, bank feed, and reporting entry points."
      actions={<Link href="/bank-accounts/new" className="rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">New bank account</Link>}
      rail={<BankRail />}
    >
      <div className="space-y-6">
        <MetricStrip
          metrics={[
            { label: 'Accounts', value: accounts.length, sublabel: 'Visible in current view' },
            { label: 'Unreconciled', value: unreconciled, sublabel: <Link href="/bank-accounts?filter=unreconciled" className="text-champagne-700 hover:underline">Open queue</Link> },
            { label: 'Payments enabled', value: paymentsEnabled, sublabel: 'Online payment targets' },
            { label: 'Auto reconciliation', value: autoRec, sublabel: 'Feed-assisted accounts' },
          ]}
        />

        <FilterBar action="/bank-accounts" searchDefault={q} searchPlaceholder="Search account name">
          <label className="text-xs font-medium uppercase text-ink-500">
            Bank
            <input
              name="bank"
              defaultValue={bank}
              placeholder="Bank name"
              className="mt-1 h-9 rounded border border-ink-200 px-3 text-sm normal-case text-ink-900"
            />
          </label>
          <label className="text-xs font-medium uppercase text-ink-500">
            Queue
            <select name="filter" defaultValue={filter} className="mt-1 h-9 rounded border border-ink-200 bg-white px-3 text-sm normal-case text-ink-900">
              <option value="">All accounts</option>
              <option value="unreconciled">Unreconciled only</option>
            </select>
          </label>
        </FilterBar>

        {accounts.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Account</TH>
                <TH>Bank</TH>
                <TH>Association</TH>
                <TH>Last reconciled</TH>
                <TH>Identifiers</TH>
                <TH>Payments</TH>
                <TH>Auto-rec</TH>
              </TR>
            </THead>
            <tbody>
              {accounts.map((account: any) => (
                <TR key={account.id}>
                  <TD>
                    <div className="font-medium text-ink-900">{account.name}</div>
                    <div className="text-xs capitalize text-ink-500">{account.account_type?.replace(/_/g, ' ')}</div>
                  </TD>
                  <TD className="text-sm text-ink-700">{account.bank_name ?? 'Not provided'}</TD>
                  <TD className="text-sm text-ink-600">{account.associations?.name ?? 'Portfolio-level'}</TD>
                  <TD className="text-sm text-ink-600">{date(account.last_reconciliation_date)}</TD>
                  <TD className="text-xs text-ink-600">
                    <div>Acct {maskBankNumber(account.account_number)}</div>
                    <div>Routing {maskBankNumber(account.routing_number)}</div>
                  </TD>
                  <TD><StatusChip tone={account.payments_enabled ? 'success' : 'neutral'}>{account.payments_enabled ? 'Enabled' : 'Not enabled'}</StatusChip></TD>
                  <TD><StatusChip tone={account.auto_reconciliation ? 'info' : 'neutral'}>{account.auto_reconciliation ? 'Enabled' : 'Not enabled'}</StatusChip></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="rounded border border-dashed border-ink-200 bg-white px-6 py-12 text-center text-sm text-ink-500">
            No bank accounts match this view.
          </p>
        )}
      </div>
    </DataWorkspace>
  );
}

function BankRail() {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-ink-900">Banking tasks</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/bank-accounts/new" label="New bank account" />
          <RailLink href="/bank-accounts/deposits/new" label="New bank deposit" />
          <RailLink href="/bank-accounts/feeds" label="Bank feed" />
          <RailLink href="/bank-accounts/reconcile" label="Reconcile" />
          <RailLink href="/bank-accounts/adjustments/new" label="Bank adjustment" />
        </div>
      </section>
      <section className="border-t border-ink-100 pt-5">
        <h2 className="text-sm font-semibold text-ink-900">Reports</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/bank-accounts/activity" label="Bank account activity" />
          <RailLink href="/reports/check_register" label="Check register" />
          <RailLink href="/reports/deposit_register" label="Deposit register" />
          <RailLink href="/reports/bank_reconciliation" label="Bank reconciliation" />
        </div>
      </section>
    </div>
  );
}

function RailLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded border border-ink-100 px-3 py-2 text-sm font-medium text-ink-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
      {label}
    </Link>
  );
}
