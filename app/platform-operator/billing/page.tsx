import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { Badge } from '@/components/ui/shell';
import { date, money } from '@/lib/utils';
import { CreditCard, DollarSign, AlertCircle, Clock, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]';
const thead = 'border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500';
const trow = 'border-b border-gray-50 last:border-0 hover:bg-gray-50/60';

export default async function BillingPage() {
  await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Stats queries
  const { data: activeSubs } = await db
    .from('subscriptions')
    .select('price_monthly_cents')
    .in('status', ['active', 'trialing']);

  const { count: openInvoices } = await db
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .not('status', 'in', '("paid","void")');

  const { data: paidThisMonth } = await db
    .from('invoices')
    .select('total_cents')
    .eq('status', 'paid')
    .gte('paid_at', monthStart);

  const { count: failedPayments } = await db
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', monthStart);

  const { count: pastDue } = await db
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'past_due');

  // Invoices with company name
  const { data: invoices } = await db
    .from('invoices')
    .select('*, portfolios!inner(company_name)')
    .order('created_at', { ascending: false })
    .limit(50);

  // Subscriptions with company name
  const { data: subscriptions } = await db
    .from('subscriptions')
    .select('*, portfolios!inner(company_name)')
    .order('created_at', { ascending: false })
    .limit(50);

  const mrr = (activeSubs ?? []).reduce((sum: number, s: any) => sum + (s.price_monthly_cents ?? 0), 0) / 100;
  const paidAmount = (paidThisMonth ?? []).reduce((sum: number, i: any) => sum + (i.total_cents ?? 0), 0) / 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Billing &amp; Payments</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Platform-wide billing overview across all companies</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Current MRR" value={money(mrr)} icon={DollarSign} />
        <StatCard label="Open Invoices" value={openInvoices ?? 0} icon={FileText} />
        <StatCard label="Paid This Month" value={money(paidAmount)} icon={CreditCard} />
        <StatCard label="Failed Payments" value={failedPayments ?? 0} icon={AlertCircle} />
        <StatCard label="Past Due" value={pastDue ?? 0} icon={Clock} />
      </div>

      {/* Invoices Table */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Invoices</h2>
          <p className="mt-0.5 text-xs text-gray-500">All invoices across the platform</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={thead}>
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Company</th>
                <th className="px-4 py-2.5 text-left font-medium">Number</th>
                <th className="px-4 py-2.5 text-left font-medium">Period</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Paid Date</th>
              </tr>
            </thead>
            <tbody>
              {(invoices ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No invoices found</td></tr>
              ) : (
                (invoices ?? []).map((inv: any) => (
                  <tr key={inv.id} className={trow}>
                    <td className="px-4 py-3 font-medium text-gray-900">{inv.portfolios?.company_name ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">{inv.number ?? `INV-${inv.id?.slice(0, 8)}`}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-gray-500">
                      {inv.period_start ? `${date(inv.period_start)} – ${date(inv.period_end)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">{money(inv.total_cents)}</td>
                    <td className="px-4 py-3"><Badge status={inv.status ?? 'open'} /></td>
                    <td className="px-4 py-3 text-xs tabular-nums text-gray-500">{date(inv.paid_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Subscriptions</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            All subscriptions across the platform. Plan changes, limits, and suspensions are managed from each company&apos;s detail page.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={thead}>
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Company</th>
                <th className="px-4 py-2.5 text-left font-medium">Plan</th>
                <th className="px-4 py-2.5 text-right font-medium">Monthly Price</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Trial End</th>
                <th className="px-4 py-2.5 text-left font-medium">Next Billing</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(subscriptions ?? []).length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No subscriptions found</td></tr>
              ) : (
                (subscriptions ?? []).map((sub: any) => (
                  <tr key={sub.id} className={trow}>
                    <td className="px-4 py-3 font-medium text-gray-900">{sub.portfolios?.company_name ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] capitalize text-gray-700">{(sub.tier ?? 'free').replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">{money((sub.price_monthly_cents ?? 0) / 100)}</td>
                    <td className="px-4 py-3"><Badge status={sub.status ?? 'inactive'} /></td>
                    <td className="px-4 py-3 text-xs tabular-nums text-gray-500">{date(sub.trial_ends_at)}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-gray-500">{date(sub.current_period_end)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/platform-operator/companies/${sub.portfolio_id}`}
                        className="text-xs font-medium text-gray-700 hover:text-gray-950 hover:underline"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
