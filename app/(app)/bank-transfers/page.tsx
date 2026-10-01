import Link from 'next/link';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// "All transfers" is the default: a posted transfer is only ever "Completed",
// and the old Individual/Group split keyed on account types that don't exist
// (the enum is checking/savings/money_market), so the default tab was always
// empty and new transfers looked lost.
const TABS = [
  { key: 'activity', label: 'All transfers' },
  { key: 'incomplete', label: 'Incomplete' },
  { key: 'completed', label: 'Completed' },
] as const;
const LEGACY_TABS: Record<string, string> = { 'incomplete-individual': 'incomplete', 'incomplete-group': 'incomplete' };

type TabKey = (typeof TABS)[number]['key'];

export default async function BankTransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  await requireStaff();
  const { tab: rawTab = 'activity', q: rawQ = '' } = await searchParams;
  const tab = LEGACY_TABS[rawTab] ?? rawTab;
  const activeTab = TABS.some((t) => t.key === tab) ? (tab as TabKey) : 'activity';
  // Strip PostgREST filter syntax characters before interpolating into .or().
  const q = rawQ.replace(/[,()*%\\]/g, ' ').trim();

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
  } else if (activeTab === 'incomplete') {
    query = query.is('journal_entry_id', null);
  }
  // 'activity' tab shows all transfers — no additional filter

  if (q) {
    query = query.or(`reference_number.ilike.%${q}%,memo.ilike.%${q}%`);
  }

  const { data: rows } = await query;
  const transfers = rows ?? [];

  // Calculate metrics
  const incompleteCount = transfers.filter((t: any) => !t.journal_entry_id).length;
  const completedCount = transfers.filter((t: any) => t.journal_entry_id).length;

  const filteredTransfers =
    activeTab === 'incomplete'
      ? transfers.filter((t: any) => !t.journal_entry_id)
      : activeTab === 'completed'
        ? transfers.filter((t: any) => t.journal_entry_id)
        : transfers;

  const totalAmount = filteredTransfers.reduce((sum: number, t: any) => sum + (t.amount ?? 0), 0);

  return (
    <DataWorkspace
      title="Bank Transfers"
      description="Inter-account transfers between operating, reserve, and trust accounts. Track pending and completed transfers, and view bank account activity."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/bank-accounts/activity"><Button variant="secondary">Bank account activity</Button></Link>
          <Link href="/bank-transfers/new">
            <Button><Plus className="h-4 w-4" /> New bank transfer</Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Tabs */}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
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
                <Link href="/bank-transfers?tab=incomplete" className="font-medium text-gray-500 transition-colors hover:text-gray-900">
                  View queue
                </Link>
              ),
            },
            {
              label: 'Completed',
              value: completedCount,
              sublabel: (
                <Link href="/bank-transfers?tab=completed" className="font-medium text-gray-500 transition-colors hover:text-gray-900">
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
        {filteredTransfers.length > 0 ? (
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
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={ArrowLeftRight}
              title={
                activeTab === 'incomplete'
                  ? 'No incomplete transfers'
                  : activeTab === 'completed'
                    ? 'No completed transfers'
                    : 'No transfers yet'
              }
              description="Transfers between operating, reserve, and trust accounts will appear here."
              action={
                <Link href="/bank-transfers/new">
                  <Button><Plus className="h-4 w-4" /> New bank transfer</Button>
                </Link>
              }
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
