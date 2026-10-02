import Link from 'next/link';
import { Landmark, Plus } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/shell';
import { DataTable } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { maskBankNumber } from '@/lib/banking/bank-format';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';
import { FinancialAccountTabs } from '@/components/banking/financial-account-tabs';

export const dynamic = 'force-dynamic';

export default async function BankAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; bank?: string; association_id?: string; error?: string }>;
}) {
  await requireStaff();
  const { filter = '', q = '', bank = '', association_id = '', error: pageError } = await searchParams;
  const assoc = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(association_id) ? association_id : '';
  const supabase = await createClient();
  const db = supabase as any;

  let query = db
    .from('bank_accounts')
    .select('id, name, bank_name, account_number, routing_number, account_type, payments_enabled, auto_reconciliation, last_reconciliation_date, next_check_number, associations!bank_accounts_association_id_fkey(name)')
    .is('archived_at', null)
    .order('name');

  if (filter === 'unreconciled') query = query.is('last_reconciliation_date', null);
  if (q) query = query.ilike('name', `%${q}%`);
  if (bank) query = query.ilike('bank_name', `%${bank}%`);
  if (assoc) query = query.eq('association_id', assoc);

  const [{ data: rows, error: loadError }, { data: associations }] = await Promise.all([
    query,
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);
  const accounts = rows ?? [];
  const needsReconciliation = accounts.filter((row: any) => !row.last_reconciliation_date).length;
  const paymentsEnabled = accounts.filter((row: any) => row.payments_enabled).length;

  return (
    <DataWorkspace
      title={filter === 'unreconciled' ? 'Unreconciled bank accounts' : 'Financial accounts'}
      description="Operating, reserve, and trust bank accounts, with deposits, bank feed, reconciliation and period close."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/bank-accounts/new">
            <Button><Plus className="h-4 w-4" /> New bank account</Button>
          </Link>
          <Link href="/bank-accounts/deposits/new">
            <Button variant="secondary">New bank deposit</Button>
          </Link>
          <Link href="/bank-accounts/feeds">
            <Button variant="secondary">Bank feed</Button>
          </Link>
          <Link href="/bank-accounts/reconcile">
            <Button variant="secondary">Reconcile</Button>
          </Link>
          <Link href="/accounting-periods">
            <Button variant="secondary">Close accounting period</Button>
          </Link>
          <Link href="/bank-accounts/link-bank">
            <Button variant="secondary">Link with bank</Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <FinancialAccountTabs active="bank" />
        {pageError && <Alert tone="warning" title="Needs attention.">{pageError}</Alert>}
        {loadError && <Alert title="Could not load bank accounts.">{loadError.message}</Alert>}
        <MetricStrip
          metrics={[
            { label: 'Total accounts', value: accounts.length, sublabel: 'Visible in current view' },
            { label: 'Payments enabled', value: paymentsEnabled, sublabel: 'Online payment targets' },
            {
              label: 'Needs reconciliation',
              value: needsReconciliation,
              sublabel: (
                <Link href="/bank-accounts?filter=unreconciled" className="font-medium text-gray-500 transition-colors hover:text-gray-900">
                  Open queue
                </Link>
              ),
            },
          ]}
        />

        <FilterBar action="/bank-accounts" searchDefault={q} searchPlaceholder="Search account name">
          <label className="text-[12px] font-medium text-gray-500">
            Bank
            <input
              name="bank"
              defaultValue={bank}
              placeholder="Bank name"
              className="mt-1 block h-10 min-w-36 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </label>
          <FilterSelect label="Association" name="association_id" defaultValue={assoc}>
            <option value="">All associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Queue" name="filter" defaultValue={filter}>
            <option value="">All accounts</option>
            <option value="unreconciled">Unreconciled only</option>
          </FilterSelect>
        </FilterBar>

        <DataTable
          rows={accounts}
          rowKey={(account: any) => account.id}
          onRowHref={(account: any) => `/bank-accounts/${account.id}`}
          columns={[
            {
              key: 'name',
              header: 'Account',
              render: (account: any) => (
                <div>
                  <div className="font-medium text-gray-900">{account.name}</div>
                  <div className="text-xs capitalize text-gray-500">{account.account_type?.replace(/_/g, ' ')}</div>
                </div>
              ),
            },
            { key: 'association', header: 'Association', render: (account: any) => account.associations?.name ?? '—' },
            { key: 'bank_name', header: 'Bank', render: (account: any) => account.bank_name ?? 'Not provided' },
            {
              key: 'account_number',
              header: 'Account number',
              className: 'font-mono',
              render: (account: any) => (account.account_number ? maskBankNumber(account.account_number) : 'Not provided'),
            },
            {
              key: 'last_reconciliation_date',
              header: 'Last reconciliation',
              render: (account: any) => date(account.last_reconciliation_date),
            },
            {
              key: 'payments_enabled',
              header: 'Payments',
              render: (account: any) => (
                <StatusChip tone={account.payments_enabled ? 'success' : 'neutral'}>
                  {account.payments_enabled ? 'Enabled' : 'Not enabled'}
                </StatusChip>
              ),
            },
            {
              key: 'auto_reconciliation',
              header: 'Auto-reconciliation',
              render: (account: any) => (
                <StatusChip tone={account.auto_reconciliation ? 'info' : 'neutral'}>
                  {account.auto_reconciliation ? 'Enabled' : 'Not enabled'}
                </StatusChip>
              ),
            },
          ]}
          empty={
            <EmptyState
              icon={Landmark}
              title="No bank accounts match this view"
              description="Adjust the filters or add a new bank account to get started."
              action={
                <Link href="/bank-accounts/new">
                  <Button><Plus className="h-4 w-4" /> New bank account</Button>
                </Link>
              }
            />
          }
        />
      </div>
    </DataWorkspace>
  );
}
