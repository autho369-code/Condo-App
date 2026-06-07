import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'incomplete-individual', label: 'Incomplete Individual' },
  { key: 'incomplete-group', label: 'Incomplete Group' },
  { key: 'completed', label: 'Completed' },
  { key: 'activity', label: 'Bank Account Activity' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default async function BankTransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  await requireStaff();
  const { tab = 'incomplete-individual', q = '' } = await searchParams;
  const activeTab = TABS.some((t) => t.key === tab) ? (tab as TabKey) : 'incomplete-individual';

  const supabase = await createClient();
  const db = supabase as any;

  // Fetch bank_transfers with related bank account names
  let query = db
    .from('bank_transfers')
    .select(
      `id, amount, transfer_date, reference_number, memo, journal_entry_id,
       from:from_bank_account_id(id, name, account_type, bank_name),
       to:to_bank_account_id(id, name, account_type, bank_name)`,
    )
    .order('transfer_date', { ascending: false })
    .limit(200);

  // Apply tab filters
  if (activeTab === 'completed') {
    query = query.not('journal_entry_id', 'is', null);
  } else if (activeTab === 'incomplete-individual' || activeTab === 'incomplete-group') {
    query = query.is('journal_entry_id', null);
  }
  // 'activity' tab shows all transfers — no additional filter

  if (q) {
    query = query.or(`reference_number.ilike.%${q}%,memo.ilike.%${q}%`);
  }

  // Fetch bank account balances for the activity view
  const { data: bankAccounts } = await db
    .from('bank_accounts')
    .select('id, name, current_balance')
    .is('archived_at', null)
    .order('name');

  const { data: rows } = await query;
  const transfers = rows ?? [];

  // Calculate metrics
  const incompleteCount = transfers.filter((t: any) => !t.journal_entry_id).length;
  const completedCount = transfers.filter((t: any) => t.journal_entry_id).length;

  // For Incomplete Individual vs Group: use account_type to distinguish
  // Individual transfers involve accounts tagged as individual/owner-related
  // Group transfers involve association/operating/reserve accounts
  const individualAccountTypes = ['individual', 'owner', 'trust'];
  const isIndividualTransfer = (t: any) => {
    const fromType = t.from?.account_type?.toLowerCase();
    const toType = t.to?.account_type?.toLowerCase();
    return (
      individualAccountTypes.some((at) => fromType?.includes(at)) ||
      individualAccountTypes.some((at) => toType?.includes(at))
    );
  };

  const filteredTransfers =
    activeTab === 'incomplete-individual'
      ? transfers.filter((t: any) => !t.journal_entry_id && isIndividualTransfer(t))
      : activeTab === 'incomplete-group'
        ? transfers.filter((t: any) => !t.journal_entry_id && !isIndividualTransfer(t))
        : activeTab === 'completed'
          ? transfers.filter((t: any) => t.journal_entry_id)
          : transfers;

  const totalAmount = filteredTransfers.reduce((sum: number, t: any) => sum + (t.amount ?? 0), 0);

  return (
    <DataWorkspace
      title="Bank Transfers"
      description="Inter-account transfers between operating, reserve, and trust accounts. Track pending and completed transfers, and view bank account activity."
      actions={
        <Link
          href="/bank-transfers/new"
          className="rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          New bank transfer
        </Link>
      }
      rail={<TransferRail />}
    >
      <div className="space-y-6">
        {/* Tabs */}
        <nav className="flex gap-1 border-b border-gray-200">
          {TABS.map(({ key, label }) => {
            const isActive = activeTab === key;
            const href = `/bank-transfers?tab=${key}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
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

        {/* Metric Strip */}
        <MetricStrip
          metrics={[
            {
              label: 'Total transfers',
              value: filteredTransfers.length,
              sublabel: activeTab === 'activity' ? 'All transfers' : 'In current view',
            },
            {
              label: 'Total amount',
              value: money(totalAmount),
              sublabel: 'Sum of filtered transfers',
            },
            {
              label: 'Incomplete',
              value: incompleteCount,
              sublabel: (
                <Link href="/bank-transfers?tab=incomplete-individual" className="text-blue-700 hover:underline">
                  View queue
                </Link>
              ),
            },
            {
              label: 'Completed',
              value: completedCount,
              sublabel: (
                <Link href="/bank-transfers?tab=completed" className="text-blue-700 hover:underline">
                  View completed
                </Link>
              ),
            },
          ]}
        />

        {/* Filters */}
        <FilterBar
          action="/bank-transfers"
          searchDefault={q}
          searchPlaceholder="Search reference # or memo"
        >
          <input type="hidden" name="tab" value={activeTab} />
        </FilterBar>

        {/* Table */}
        {activeTab === 'activity' ? (
          <BankActivityView bankAccounts={bankAccounts ?? []} />
        ) : filteredTransfers.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>From Account</TH>
                <TH>To Account</TH>
                <TH className="text-right">Amount</TH>
                <TH>Reference #</TH>
                <TH>Memo</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {filteredTransfers.map((t: any) => (
                <TR key={t.id} className="cursor-pointer hover:bg-gray-50">
                  <TD className="whitespace-nowrap text-sm">{date(t.transfer_date)}</TD>
                  <TD>
                    <div className="font-medium text-gray-900">{t.from?.name ?? '—'}</div>
                    <div className="text-xs capitalize text-gray-500">
                      {t.from?.account_type?.replace(/_/g, ' ') ?? ''}
                    </div>
                  </TD>
                  <TD>
                    <div className="font-medium text-gray-900">{t.to?.name ?? '—'}</div>
                    <div className="text-xs capitalize text-gray-500">
                      {t.to?.account_type?.replace(/_/g, ' ') ?? ''}
                    </div>
                  </TD>
                  <TD className="text-right tabular-nums font-medium">{money(t.amount)}</TD>
                  <TD className="font-mono text-xs text-gray-600">
                    {t.reference_number ?? '—'}
                  </TD>
                  <TD className="max-w-xs truncate text-sm text-gray-600">{t.memo ?? '—'}</TD>
                  <TD>
                    <StatusChip tone={t.journal_entry_id ? 'success' : 'warning'}>
                      {t.journal_entry_id ? 'Completed' : 'Incomplete'}
                    </StatusChip>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <p className="text-sm text-gray-500">
              {activeTab === 'incomplete-individual'
                ? 'No incomplete individual transfers.'
                : activeTab === 'incomplete-group'
                  ? 'No incomplete group transfers.'
                  : 'No completed transfers.'}
            </p>
            <Link
              href="/bank-transfers/new"
              className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline"
            >
              Create a new bank transfer
            </Link>
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

/** Bank Account Activity view tab — summary of all bank accounts */
function BankActivityView({ bankAccounts }: { bankAccounts: any[] }) {
  if (bankAccounts.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
        <p className="text-sm text-gray-500">No bank accounts found.</p>
        <Link
          href="/bank-accounts/new"
          className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline"
        >
          Create a bank account
        </Link>
      </div>
    );
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Account Name</TH>
          <TH>Bank</TH>
          <TH>Type</TH>
          <TH className="text-right">Current Balance</TH>
          <TH>Activity</TH>
        </TR>
      </THead>
      <tbody>
        {bankAccounts.map((account: any) => (
          <TR key={account.id} className="cursor-pointer hover:bg-gray-50">
            <TD>
              <Link
                href={`/bank-accounts/${account.id}`}
                className="font-medium text-gray-900 hover:text-brand-700"
              >
                {account.name}
              </Link>
            </TD>
            <TD className="text-sm text-gray-600">{account.bank_name ?? '—'}</TD>
            <TD className="text-sm capitalize text-gray-600">
              {account.account_type?.replace(/_/g, ' ') ?? '—'}
            </TD>
            <TD className="text-right tabular-nums font-medium">
              {money(account.current_balance)}
            </TD>
            <TD>
              <Link
                href={`/bank-accounts/activity`}
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                View activity
              </Link>
            </TD>
          </TR>
        ))}
      </tbody>
    </Table>
  );
}

/** Right rail — task panel for incomplete and completed transfers */
function TransferRail() {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-gray-950">Tasks</h2>
        <div className="mt-3 grid gap-2">
          <RailLink
            href="/bank-transfers?tab=incomplete-individual"
            label="View incomplete individual transfers"
          />
          <RailLink
            href="/bank-transfers?tab=incomplete-group"
            label="View incomplete group transfers"
          />
          <RailLink
            href="/bank-transfers?tab=completed"
            label="View completed transfers"
          />
        </div>
      </section>
      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Banking</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/bank-transfers/new" label="New Bank Transfer" />
          <RailLink href="/bank-accounts" label="Bank Accounts" />
          <RailLink href="/bank-accounts/reconcile" label="Bank Reconciliation" />
          <RailLink href="/bank-accounts/feeds" label="Bank Feed" />
        </div>
      </section>
      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Reports</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/reports?slug=cash-flow" label="Cash Flow" />
          <RailLink href="/reports?slug=check_register" label="Check Register" />
          <RailLink
            href="/reports?slug=trust_account_balance"
            label="Trust Account Balance"
          />
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
