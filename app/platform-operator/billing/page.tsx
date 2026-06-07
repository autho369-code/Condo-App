import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { date, money } from '@/lib/utils';
import { CreditCard, DollarSign, AlertCircle, Clock, FileText, Send, RotateCcw, Pause } from 'lucide-react';

export const dynamic = 'force-dynamic';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'navy',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
  accent?: 'navy' | 'emerald' | 'amber' | 'red' | 'violet';
}) {
  const accents: Record<string, string> = {
    navy: 'bg-[#1E3A5F]/10 text-[#1E3A5F] border-[#1E3A5F]/20',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    violet: 'bg-violet-100 text-violet-700 border-violet-200',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    open: 'bg-amber-100 text-amber-700 ring-amber-200',
    past_due: 'bg-red-100 text-red-700 ring-red-200',
    failed: 'bg-red-100 text-red-700 ring-red-200',
    void: 'bg-gray-100 text-gray-500 ring-gray-200',
    active: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    trialing: 'bg-blue-100 text-blue-700 ring-blue-200',
    canceled: 'bg-gray-100 text-gray-500 ring-gray-200',
    past_due_sub: 'bg-red-100 text-red-700 ring-red-200',
  };
  const cls = map[status] ?? 'bg-gray-100 text-gray-600 ring-gray-200';
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

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
        <h1 className="text-2xl font-bold text-gray-900">Billing &amp; Payments</h1>
        <p className="mt-1 text-sm text-gray-500">Platform-wide billing overview across all companies</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Current MRR" value={money(mrr)} icon={DollarSign} accent="emerald" />
        <StatCard label="Open Invoices" value={openInvoices ?? 0} icon={FileText} accent="amber" />
        <StatCard label="Paid This Month" value={money(paidAmount)} icon={CreditCard} accent="emerald" />
        <StatCard label="Failed Payments" value={failedPayments ?? 0} icon={AlertCircle} accent="red" />
        <StatCard label="Past Due" value={pastDue ?? 0} icon={Clock} accent="red" />
      </div>

      {/* Billing Actions */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Billing Actions</div>
        <div className="flex flex-wrap gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Send className="h-4 w-4" /> Send Invoice
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <CreditCard className="h-4 w-4" /> Apply Credit
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <RotateCcw className="h-4 w-4" /> Refund Payment
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Pause className="h-4 w-4" /> Pause Billing
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Invoices</h2>
          <p className="mt-0.5 text-xs text-gray-500">All invoices across the platform</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Number</th>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Paid Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(invoices ?? []).length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No invoices found</td></tr>
              ) : (
                (invoices ?? []).map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{inv.portfolios?.company_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{inv.number ?? `INV-${inv.id?.slice(0, 8)}`}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {inv.period_start ? `${date(inv.period_start)} – ${date(inv.period_end)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">{money(inv.total_cents)}</td>
                    <td className="px-4 py-3"><Badge status={inv.status ?? 'open'} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{date(inv.paid_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="cursor-pointer text-xs text-[#1E3A5F] hover:underline">Mark Paid</span>
                        <span className="text-gray-300">|</span>
                        <span className="cursor-pointer text-xs text-red-500 hover:underline">Void</span>
                        <span className="text-gray-300">|</span>
                        <span className="cursor-pointer text-xs text-[#1E3A5F] hover:underline">View</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Subscriptions</h2>
          <p className="mt-0.5 text-xs text-gray-500">All active subscriptions across the platform</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-right">Monthly Price</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Trial End</th>
                <th className="px-4 py-3 text-left">Next Billing</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(subscriptions ?? []).length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No subscriptions found</td></tr>
              ) : (
                (subscriptions ?? []).map((sub: any) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{sub.portfolios?.company_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{(sub.tier ?? 'free').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">{money((sub.price_monthly_cents ?? 0) / 100)}</td>
                    <td className="px-4 py-3"><Badge status={sub.status ?? 'inactive'} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{date(sub.trial_ends_at)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{date(sub.current_period_end)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="cursor-pointer text-xs text-[#1E3A5F] hover:underline">Pause</span>
                        <span className="text-gray-300">|</span>
                        <span className="cursor-pointer text-xs text-[#1E3A5F] hover:underline">Resume</span>
                        <span className="text-gray-300">|</span>
                        <span className="cursor-pointer text-xs text-red-500 hover:underline">Cancel</span>
                        <span className="text-gray-300">|</span>
                        <span className="cursor-pointer text-xs text-[#1E3A5F] hover:underline">Change Plan</span>
                      </div>
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
