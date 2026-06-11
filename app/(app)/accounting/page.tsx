import Link from 'next/link';
import { Plus } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Surface, SectionTitle } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AccountingPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  // Open bills: pending_approval status
  const openBillsQuery = db
    .from('payable_bills')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .eq('status', 'pending_approval');

  // Total unpaid balance: bills not paid or voided
  const unpaidQuery = db
    .from('payable_bills')
    .select('amount')
    .is('archived_at', null)
    .not('status', 'in', '("paid","void")');

  // Upcoming check run: approved bills ready for payment
  const approvedQuery = db
    .from('payable_bills')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .eq('status', 'approved');

  // AR aging: outstanding receivables
  const arAgingQuery = db
    .from('aged_receivables')
    .select('balance_due, aging_bucket');

  // Bank accounts count
  const bankAccountsQuery = db
    .from('bank_accounts')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null);

  // GL accounts count
  const glAccountsQuery = db
    .from('gl_accounts')
    .select('id', { count: 'exact', head: true });

  const [
    { count: openBills },
    { data: unpaidBills },
    { count: approvedBills },
    { data: arAgingRows },
    { count: bankAccounts },
    { count: glAccounts },
  ] = await Promise.all([
    openBillsQuery,
    unpaidQuery,
    approvedQuery,
    arAgingQuery,
    bankAccountsQuery,
    glAccountsQuery,
  ]);

  const totalUnpaid = (unpaidBills ?? []).reduce(
    (sum: number, b: any) => sum + Number(b.amount ?? 0),
    0
  );

  // AR aging summary
  const agingBuckets = (arAgingRows ?? []).reduce(
    (acc: Record<string, number>, row: any) => {
      const bucket = row.aging_bucket ?? 'unknown';
      acc[bucket] = (acc[bucket] ?? 0) + Number(row.balance_due ?? 0);
      return acc;
    },
    {} as Record<string, number>
  );

  const totalAR = (
    (agingBuckets['current'] ?? 0) +
    (agingBuckets['1-30'] ?? 0) +
    (agingBuckets['30-60'] ?? 0) +
    (agingBuckets['60-90'] ?? 0) +
    (agingBuckets['90+'] ?? 0)
  );
  const overdueAR =
    (agingBuckets['30-60'] ?? 0) +
    (agingBuckets['60-90'] ?? 0) +
    (agingBuckets['90+'] ?? 0);

  const metrics = [
    {
      label: 'Open bills',
      value: openBills ?? 0,
      sublabel: (
        <Link href="/bills?status=pending_approval" className="font-medium text-gray-500 transition-colors hover:text-gray-900">
          Review bills
        </Link>
      ),
    },
    {
      label: 'Unpaid balance',
      value: money(totalUnpaid),
      sublabel: (
        <Link href="/bills" className="font-medium text-gray-500 transition-colors hover:text-gray-900">
          All payables
        </Link>
      ),
    },
    {
      label: 'Check run',
      value: approvedBills ?? 0,
      sublabel: (
        <Link href="/bills/check-run" className="font-medium text-gray-500 transition-colors hover:text-gray-900">
          Approved bills
        </Link>
      ),
    },
    {
      label: 'AR overdue',
      value: money(overdueAR),
      sublabel: totalAR > 0 ? (
        <span>
          {money(totalAR)} total ·{' '}
          <Link href="/reports/ar-aging" className="font-medium text-gray-500 transition-colors hover:text-gray-900">
            AR aging report
          </Link>
        </span>
      ) : undefined,
    },
  ];

  const quickLinks = [
    { label: 'Payables', href: '/bills', description: 'View and manage bills' },
    { label: 'Check run', href: '/bills/check-run', description: 'Print checks for approved bills' },
    { label: 'Receivables', href: '/charges', description: 'Owner charges and collections' },
    { label: 'Bank accounts', href: '/bank-accounts', description: `${bankAccounts ?? 0} active accounts` },
    { label: 'Bank transfers', href: '/bank-transfers', description: 'Move funds between accounts' },
    { label: 'GL accounts', href: '/gl-accounts', description: `${glAccounts ?? 0} chart of accounts` },
    { label: 'Journal entries', href: '/journal-entries', description: 'Manual accounting entries' },
    { label: 'Diagnostics', href: '/diagnostics', description: 'Balance checks and data health' },
  ];

  return (
    <DataWorkspace
      title="Accounting"
      description="Payables, receivables, bank accounts, and the general ledger — all from one dashboard."
      actions={
        <>
          <Link href="/bills/new"><Button><Plus className="h-4 w-4" /> New bill</Button></Link>
          <Link href="/bills/check-run"><Button variant="secondary">Check run</Button></Link>
        </>
      }
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        <section>
          <SectionTitle title="Quick links" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl border border-gray-200/70 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_1px_3px_rgba(16,24,40,0.08),0_4px_12px_-4px_rgba(16,24,40,0.1)]"
              >
                <div className="text-sm font-medium text-gray-950">{link.label}</div>
                <div className="mt-1 text-xs text-gray-500">{link.description}</div>
              </Link>
            ))}
          </div>
        </section>

        {agingBuckets && Object.keys(agingBuckets).length > 0 && (
          <Surface padded={false}>
            <div className="border-b border-gray-100 px-5 py-4">
              <SectionTitle
                title="AR aging summary"
                description="Outstanding receivables by aging bucket."
                className="mb-0"
              />
            </div>
            <div className="divide-y divide-gray-100">
              {(['current', '1-30', '30-60', '60-90', '90+'] as const).map((bucket) => {
                const amount = agingBuckets[bucket] ?? 0;
                if (amount === 0) return null;
                const isOverdue = bucket === '30-60' || bucket === '60-90' || bucket === '90+';
                return (
                  <div key={bucket} className="flex items-center justify-between px-5 py-3">
                    <span className={`text-sm ${isOverdue ? 'font-medium text-red-700' : 'text-gray-700'}`}>
                      {bucket === 'current' ? 'Current' : `${bucket} days`}
                    </span>
                    <span className={`text-sm tabular-nums font-medium ${isOverdue ? 'text-red-700' : 'text-gray-950'}`}>
                      {money(amount)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-100 px-5 py-3">
              <Link href="/reports/ar-aging" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-950">
                View full AR aging report →
              </Link>
            </div>
          </Surface>
        )}
      </div>
    </DataWorkspace>
  );
}
