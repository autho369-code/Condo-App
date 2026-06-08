// Bank Feed page — imported transactions with auto-match review
// /bank-accounts/feeds

import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date, money as currency } from '@/lib/utils';
import { RefreshButton } from './sync-button';

export const dynamic = 'force-dynamic';

export default async function BankFeedsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    q?: string;
    bank_account_id?: string;
  }>;
}) {
  await requireStaff();
  const { filter = '', q = '', bank_account_id = '' } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  // Load connected Plaid items
  const { data: plaidItems } = await db
    .from('plaid_items')
    .select('id, plaid_institution_name, bank_account_id, status, last_sync_at')
    .eq('status', 'active')
    .order('plaid_institution_name');

  const activeConnections = plaidItems || [];

  // Load imported transactions
  let query = db
    .from('bank_transactions')
    .select(
      'id, amount, date, name, merchant_name, category, pending, reviewed, gl_account_id, match_confidence, bank_account_id, bank_accounts(name), gl_accounts(number, name)'
    )
    .order('date', { ascending: false })
    .limit(100);

  if (filter === 'unreviewed') query = query.eq('reviewed', false);
  if (filter === 'unmatched') query = query.is('gl_account_id', null);
  if (filter === 'pending') query = query.eq('pending', true);
  if (bank_account_id) query = query.eq('bank_account_id', bank_account_id);
  if (q) query = query.or(`name.ilike.%${q}%,merchant_name.ilike.%${q}%`);

  const { data: transactions } = await query;
  const txns = transactions || [];

  // Load bank accounts for filter dropdown
  const { data: bankAccounts } = await db
    .from('bank_accounts')
    .select('id, name')
    .is('archived_at', null)
    .order('name');

  const unreviewedCount = txns.filter((t: any) => !t.reviewed).length;
  const unmatchedCount = txns.filter((t: any) => !t.gl_account_id).length;
  const pendingCount = txns.filter((t: any) => t.pending).length;

  return (
    <DataWorkspace
      title="Bank feed"
      description="Imported transactions from linked bank accounts. Review auto-matched GL accounts or reassign as needed."
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/bank-accounts/link-bank"
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Connect bank
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {activeConnections.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeConnections.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-medium text-gray-800">
                  {item.plaid_institution_name || 'Connected Bank'}
                </span>
                <span className="text-gray-400">
                  Last sync: {item.last_sync_at ? date(item.last_sync_at) : 'Never'}
                </span>
                <RefreshButton plaidItemId={item.id} />
              </div>
            ))}
          </div>
        )}

        <MetricStrip
          metrics={[
            { label: 'Transactions', value: txns.length, sublabel: 'In current view' },
            { label: 'Unreviewed', value: unreviewedCount, sublabel: txns.length > 0 ? `${Math.round((unreviewedCount / txns.length) * 100)}%` : '—' },
            { label: 'Unmatched', value: unmatchedCount, sublabel: txns.length > 0 ? 'Needs GL assignment' : '—' },
          ]}
        />

        <FilterBar action="/bank-accounts/feeds" searchDefault={q} searchPlaceholder="Search by name">
          <label className="text-xs font-medium uppercase text-gray-500">
            Queue
            <select
              name="filter"
              defaultValue={filter}
              className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900"
            >
              <option value="">All transactions</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="unmatched">Unmatched</option>
              <option value="pending">Pending only</option>
            </select>
          </label>

          {(bankAccounts || []).length > 1 && (
            <label className="text-xs font-medium uppercase text-gray-500">
              Account
              <select
                name="bank_account_id"
                defaultValue={bank_account_id}
                className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900"
              >
                <option value="">All accounts</option>
                {(bankAccounts || []).map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </FilterBar>

        {txns.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Description</TH>
                <TH>Amount</TH>
                <TH>GL Account</TH>
                <TH>Match</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {txns.map((txn: any) => (
                <TR key={txn.id} className="cursor-pointer hover:bg-gray-50">
                  <TD className="text-sm text-gray-700">{date(txn.date)}</TD>
                  <TD>
                    <Link href={`/bank-accounts/feeds/${txn.id}`} className="block text-gray-900 hover:text-brand-700">
                      <div className="font-medium">{txn.name}</div>
                      {txn.merchant_name && (
                        <div className="text-xs text-gray-500">{txn.merchant_name}</div>
                      )}
                      {txn.category && (
                        <div className="text-xs capitalize text-gray-400">{txn.category.replace(/_/g, ' ')}</div>
                      )}
                    </Link>
                  </TD>
                  <TD className="text-sm text-gray-700">
                    <span className={txn.amount < 0 ? 'text-red-600' : 'text-emerald-600'}>
                      ${Math.abs(txn.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </TD>
                  <TD>
                    {txn.gl_accounts ? (
                      <div className="text-sm">
                        <span className="font-mono text-gray-500">{txn.gl_accounts.number}</span>
                        <span className="ml-1.5 text-gray-700">{txn.gl_accounts.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-amber-600">Not matched</span>
                    )}
                  </TD>
                  <TD>
                    {txn.match_confidence ? (
                      <StatusChip tone={txn.match_confidence >= 0.8 ? 'success' : txn.match_confidence >= 0.5 ? 'info' : 'warning'}>
                        {txn.match_method === 'auto' ? 'Auto' : 'Manual'} ({Math.round(txn.match_confidence * 100)}%)
                      </StatusChip>
                    ) : (
                      <StatusChip tone="neutral">Pending</StatusChip>
                    )}
                  </TD>
                  <TD>
                    {txn.pending ? (
                      <StatusChip tone="warning">Pending</StatusChip>
                    ) : txn.reviewed ? (
                      <StatusChip tone="success">Reviewed</StatusChip>
                    ) : (
                      <StatusChip tone="neutral">Needs review</StatusChip>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : activeConnections.length === 0 ? (
          <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-900">No bank connections</p>
            <p className="mt-1 text-sm text-gray-500">
              Link a bank account via Plaid to start importing transactions.
            </p>
            <Link
              href="/bank-accounts/link-bank"
              className="mt-4 inline-block rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Connect bank
            </Link>
          </div>
        ) : (
          <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-900">No transactions yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Click the sync button on your connected bank to import transactions, or they will appear once your bank processes them.
            </p>
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
