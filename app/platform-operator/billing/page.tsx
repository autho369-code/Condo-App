import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { Badge } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { date, money } from '@/lib/utils';
import { CreditCard, DollarSign, AlertCircle, Clock, FileText } from 'lucide-react';
import { generateInvoice, markInvoicePaid, voidInvoice } from '../companies/actions';

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

export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePlatformOperator();
  const sp = await searchParams;
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

  // Companies for the "generate invoice" picker
  const { data: companies } = await db
    .from('portfolios')
    .select('id, company_name')
    .is('archived_at', null)
    .order('company_name');

  const mrr = (activeSubs ?? []).reduce((sum: number, s: any) => sum + (s.price_monthly_cents ?? 0), 0) / 100;
  const paidAmount = (paidThisMonth ?? []).reduce((sum: number, i: any) => sum + (i.total_cents ?? 0), 0) / 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Billing &amp; Payments</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Platform-wide billing overview across all companies</p>
      </div>

      {sp.error && (<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sp.error}</div>)}
      {(sp.invoice_generated || sp.invoice_paid || sp.invoice_voided) && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sp.invoice_generated ? 'Invoice generated.' : sp.invoice_paid ? 'Invoice marked paid.' : 'Invoice voided.'}
        </div>
      )}

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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-950">Invoices</h2>
              <p className="mt-0.5 text-xs text-gray-500">All invoices across the platform. Billed offline — generate one, then mark it paid.</p>
            </div>
            <form action={generateInvoice as any} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="return_to" value="/platform-operator/billing" />
              <div>
                <Label htmlFor="inv_company" className="text-xs">Company</Label>
                <select id="inv_company" name="portfolio_id" required className="h-9 w-48 rounded-md border border-gray-300 bg-white px-2 text-sm">
                  <option value="">Select company</option>
                  {(companies ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="inv_amount" className="text-xs">Amount ($)</Label>
                <Input id="inv_amount" name="amount" type="number" step="0.01" min="0" placeholder="Plan price" className="h-9 w-28" />
              </div>
              <div>
                <Label htmlFor="inv_start" className="text-xs">Period start</Label>
                <Input id="inv_start" name="period_start" type="date" className="h-9 w-36" />
              </div>
              <div>
                <Label htmlFor="inv_end" className="text-xs">Period end</Label>
                <Input id="inv_end" name="period_end" type="date" className="h-9 w-36" />
              </div>
              <Button type="submit" size="sm">Generate</Button>
            </form>
          </div>
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
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(invoices ?? []).length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No invoices yet — generate one above.</td></tr>
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
                    <td className="px-4 py-3 text-right">
                      {inv.status !== 'paid' && inv.status !== 'void' ? (
                        <div className="flex justify-end gap-1">
                          <form action={markInvoicePaid as any}>
                            <input type="hidden" name="invoice_id" value={inv.id} />
                            <input type="hidden" name="portfolio_id" value={inv.portfolio_id} />
                            <input type="hidden" name="return_to" value="/platform-operator/billing" />
                            <Button type="submit" variant="ghost" size="sm">Mark paid</Button>
                          </form>
                          <form action={voidInvoice as any}>
                            <input type="hidden" name="invoice_id" value={inv.id} />
                            <input type="hidden" name="portfolio_id" value={inv.portfolio_id} />
                            <input type="hidden" name="return_to" value="/platform-operator/billing" />
                            <Button type="submit" variant="ghost" size="sm" className="text-red-600 hover:text-red-700">Void</Button>
                          </form>
                        </div>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
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
