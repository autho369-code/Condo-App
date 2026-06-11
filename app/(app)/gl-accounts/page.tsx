import Link from 'next/link';
import { BookOpen, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { EmptyState, SectionTitle } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const RANGES: Array<{ from: number; to: number; label: string }> = [
  { from: 1000, to: 1999, label: 'Assets' },
  { from: 2000, to: 2999, label: 'Liabilities' },
  { from: 3000, to: 3999, label: 'Equity' },
  { from: 4000, to: 4999, label: 'Income' },
  { from: 5000, to: 5999, label: 'Cost of Goods Sold' },
  { from: 6000, to: 6999, label: 'Operating Expenses' },
  { from: 7000, to: 7999, label: 'Other Income' },
  { from: 8000, to: 8999, label: 'Other Expenses' },
  { from: 9000, to: 9999, label: 'Non-Operating' },
];

export default async function GLAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStaff();
  const { q = '' } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  let query = db
    .from('gl_accounts')
    .select('id, number, name, account_type, fund_account, active, include_on_cash_flow, subject_to_management_fees')
    .order('number');

  if (q) {
    query = query.or(`name.ilike.%${q}%,number::text.ilike.%${q}%`);
  }

  const { data: rows } = await query;
  const accounts = (rows ?? []) as any[];

  const activeCount = accounts.filter((a: any) => a.active).length;
  const inactiveCount = accounts.filter((a: any) => !a.active).length;
  const fundCount = accounts.filter((a: any) => a.fund_account).length;

  const grouped = RANGES.map((r) => ({
    ...r,
    items: accounts.filter((a: any) => a.number >= r.from && a.number <= r.to),
  })).filter((g) => g.items.length > 0);

  return (
    <DataWorkspace
      title="GL Accounts"
      description="Chart of accounts for the portfolio. Ranges follow standard accounting conventions (1xxx Assets, 2xxx Liabilities, 3xxx Equity, 4xxx Income, 5xxx COGS, 6xxx Expenses, 7xxx Other Income, 8xxx Other Expenses, 9xxx Non-Operating)."
      actions={
        <Link href="/gl-accounts/new">
          <Button><Plus className="h-4 w-4" /> New GL account</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <MetricStrip
          metrics={[
            { label: 'Total accounts', value: accounts.length, sublabel: 'All GL accounts' },
            { label: 'Active', value: activeCount, sublabel: accounts.length > 0 ? `${((activeCount / accounts.length) * 100).toFixed(0)}% of total` : '—' },
            { label: 'Inactive', value: inactiveCount, sublabel: 'Archived or disabled' },
            { label: 'Fund accounts', value: fundCount, sublabel: 'Mapped to a fund' },
          ]}
        />

        <FilterBar action="/gl-accounts" searchDefault={q} searchPlaceholder="Search by name or account number" />

        {accounts.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={BookOpen}
              title={q ? 'No GL accounts match your search' : 'No GL accounts configured yet'}
              description="The chart of accounts will appear here, grouped by account range."
              action={!q && (
                <Link href="/gl-accounts/new">
                  <Button><Plus className="h-4 w-4" /> Create your first GL account</Button>
                </Link>
              )}
            />
          </div>
        ) : grouped.length === 0 && q ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState icon={BookOpen} title={`No GL accounts match “${q}”`} />
          </div>
        ) : (
          grouped.map((g) => (
            <section key={g.label}>
              <SectionTitle
                title={`${g.from}s — ${g.label}`}
                actions={
                  <span className="text-xs text-gray-400">{g.items.length} account{g.items.length !== 1 ? 's' : ''}</span>
                }
              />
              <Table>
                <THead>
                  <tr>
                    <TH>Number</TH>
                    <TH>Name</TH>
                    <TH>Account Type</TH>
                    <TH>Fund Account</TH>
                    <TH>Active</TH>
                  </tr>
                </THead>
                <tbody>
                  {g.items.map((a: any) => (
                    <TR key={a.id}>
                      <TD className="font-mono tabular-nums">{a.number}</TD>
                      <TD className="font-medium">{a.name}</TD>
                      <TD className="capitalize">{a.account_type?.replace(/_/g, ' ')}</TD>
                      <TD className="capitalize text-gray-600">{a.fund_account?.replace(/_/g, ' ') ?? '—'}</TD>
                      <TD>
                        <StatusChip tone={a.active ? 'success' : 'neutral'}>
                          {a.active ? 'Active' : 'Inactive'}
                        </StatusChip>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </section>
          ))
        )}
      </div>
    </DataWorkspace>
  );
}
