import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { Badge } from '@/components/ui/shell'
import { date, money } from '@/lib/utils'
import { CreditCard, DoorOpen, Receipt, TrendingUp, BarChart3, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

export default async function BillingPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id

  // Subscription
  const { data: sub } = await db
    .from('subscriptions')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .maybeSingle()

  // Door metrics from view
  const { data: metrics } = await db
    .from('v_company_metrics')
    .select('doors_active, doors_limit, total_doors')
    .eq('portfolio_id', portfolioId)
    .order('period', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Invoices
  const { data: invoices } = await db
    .from('invoices')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('period_end', { ascending: false })
    .limit(20)

  const s = sub ?? {}
  const tierName = (s.tier ?? 'free').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const status = s.status ?? 'inactive'
  const monthlyPrice = s.price_monthly_cents ? s.price_monthly_cents / 100 : 0
  const activeDoors = metrics?.doors_active ?? metrics?.total_doors ?? 0
  const doorsLimit = metrics?.doors_limit ?? s.units_limit ?? s.associations_limit ?? 0
  const doorUsagePct = doorsLimit > 0 ? Math.min(100, Math.round((activeDoors / doorsLimit) * 100)) : 0
  const isOverLimit = activeDoors > doorsLimit
  const overageDoors = isOverLimit ? activeDoors - doorsLimit : 0
  const doorOverageCharge = overageDoors * ((metrics?.price_per_door_cents ?? 100) / 100) || 0
  const projectedTotal = monthlyPrice + doorOverageCharge

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Billing &amp; Doors</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">
            Manage your subscription, monitor door usage for {me.portfolio?.company_name ?? me.portfolio?.name ?? 'your portfolio'}
          </p>
        </div>
      </div>

      {/* Top Cards: Plan + Doors + Current Charge */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Plan Card */}
        <div className={`${card} p-6`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-gray-50 p-2 ring-1 ring-inset ring-gray-200/70">
              <CreditCard className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Current Plan</div>
              <div className="text-xl font-semibold text-gray-950">{tierName}</div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`font-medium capitalize ${status === 'active' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Monthly Price</span>
              <span className="font-medium tabular-nums text-gray-950">{money(monthlyPrice)}</span>
            </div>
            {s.seats_included != null && (
              <div className="flex justify-between">
                <span className="text-gray-500">Seats</span>
                <span className="font-medium tabular-nums text-gray-950">{s.seats_used ?? 0} / {s.seats_included}</span>
              </div>
            )}
            {s.trial_ends_at && (
              <div className="flex justify-between">
                <span className="text-gray-500">Trial Ends</span>
                <span className="font-medium text-amber-700">{date(s.trial_ends_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Doors Card */}
        <div className={`${card} p-6`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-gray-50 p-2 ring-1 ring-inset ring-gray-200/70">
              <DoorOpen className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Active Doors</div>
              <div className="text-xl font-semibold tabular-nums text-gray-950">{activeDoors.toLocaleString()} <span className="text-sm font-normal text-gray-500">/ {doorsLimit.toLocaleString()} limit</span></div>
            </div>
          </div>
          <div className="mb-2 h-3 w-full rounded-full bg-gray-100">
            <div
              className="h-3 rounded-full transition-all"
              style={{
                width: `${doorUsagePct}%`,
                backgroundColor: doorUsagePct >= 90 ? '#EF4444' : doorUsagePct >= 75 ? '#F59E0B' : '#10B981',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{doorUsagePct}% used</span>
            {isOverLimit && <span className="font-medium text-red-700">Overage: {overageDoors} doors</span>}
          </div>
        </div>

        {/* Current Charge Card */}
        <div className={`${card} p-6`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-gray-50 p-2 ring-1 ring-inset ring-gray-200/70">
              <Receipt className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Current Month</div>
              <div className="text-xl font-semibold tabular-nums text-gray-950">{money(projectedTotal)}</div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Base Plan</span>
              <span className="font-medium tabular-nums text-gray-950">{money(monthlyPrice)}</span>
            </div>
            {isOverLimit && (
              <div className="flex justify-between">
                <span className="text-gray-500">Door Overage ({overageDoors} doors)</span>
                <span className="font-medium tabular-nums text-red-700">{money(doorOverageCharge)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-100 pt-2 font-semibold">
              <span className="text-gray-950">Total</span>
              <span className="tabular-nums text-gray-950">{money(projectedTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/company-admin/platform-requests"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-gray-50"
        >
          <DoorOpen className="h-4 w-4 text-gray-400" /> Request More Doors
        </Link>
        <Link
          href="/company-admin/platform-requests"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-gray-50"
        >
          <TrendingUp className="h-4 w-4 text-gray-400" /> Request Plan Upgrade
        </Link>
        <Link
          href="/company-admin/platform-requests"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-gray-50"
        >
          <Receipt className="h-4 w-4 text-gray-400" /> Billing Review
        </Link>
      </div>

      {/* Projected Next Invoice */}
      <div className={`${card} p-6`}>
        <div className="mb-4 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-950">Projected Next Invoice</h2>
        </div>
        <div className="text-3xl font-semibold tabular-nums text-gray-950">{money(projectedTotal)}</div>
        <div className="mt-1 text-sm text-gray-500">
          {s.current_period_end ? `Due ${date(s.current_period_end)}` : 'N/A'}
        </div>
      </div>

      {/* Payment Method */}
      <div className={`${card} p-6`}>
        <div className="mb-4 flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-950">Payment Method</h2>
        </div>
        <div className="text-sm text-gray-600">
          {s.stripe_customer_id
            ? 'Payment method on file via Stripe'
            : 'No payment method configured'}
        </div>
        {s.billing_email && (
          <div className="mt-2 text-xs text-gray-500">Billing contact: {s.billing_email}</div>
        )}
        {s.stripe_subscription_id && (
          <div className="mt-1 text-xs text-gray-400">Subscription ID: {s.stripe_subscription_id}</div>
        )}
      </div>

      {/* Invoice History */}
      <div className={card}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Invoice History</h2>
            <p className="mt-0.5 text-xs text-gray-500">Recent invoices for your portfolio</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Invoice #</th>
                <th className="px-4 py-2.5 text-left font-medium">Period</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">View</th>
              </tr>
            </thead>
            <tbody>
              {(invoices ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <BarChart3 className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <div className="text-sm font-semibold text-gray-900">No invoices yet</div>
                    <div className="mt-1 text-sm text-gray-500">Invoices are generated at the end of each billing period</div>
                  </td>
                </tr>
              ) : (
                (invoices ?? []).map((inv: any) => (
                  <tr key={inv.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-[13px] tabular-nums text-gray-700">{inv.number ?? `INV-${inv.id?.slice(0, 8)}`}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-gray-700">
                      {inv.period_start && inv.period_end
                        ? `${date(inv.period_start)} – ${date(inv.period_end)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-950">
                      {money(inv.total_cents)}
                    </td>
                    <td className="px-4 py-3"><Badge status={inv.status ?? '—'} /></td>
                    <td className="px-4 py-3 text-right">
                      {inv.stripe_invoice_url ? (
                        <a
                          href={inv.stripe_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                        >
                          <FileText className="h-3 w-3" /> View PDF
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
