import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { date, money } from '@/lib/utils'
import { CreditCard, DoorOpen, Receipt, TrendingUp, BarChart3, Send, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

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
          <h1 className="text-2xl font-bold text-white">Billing &amp; Doors</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage your subscription, monitor door usage for {me.portfolio?.company_name ?? me.portfolio?.name ?? 'your portfolio'}
          </p>
        </div>
      </div>

      {/* Top Cards: Plan + Doors + Current Charge */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Plan Card */}
        <div className="rounded-xl border border-[#1E293B] p-6" style={{ backgroundColor: '#0B1121' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg p-2" style={{ backgroundColor: '#ffffff10' }}>
              <CreditCard className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Current Plan</div>
              <div className="text-xl font-bold text-white">{tierName}</div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Status</span>
              <span className={`font-medium capitalize ${status === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Monthly Price</span>
              <span className="font-medium text-white">{money(monthlyPrice)}</span>
            </div>
            {s.seats_included != null && (
              <div className="flex justify-between">
                <span className="text-slate-400">Seats</span>
                <span className="font-medium text-white">{s.seats_used ?? 0} / {s.seats_included}</span>
              </div>
            )}
            {s.trial_ends_at && (
              <div className="flex justify-between">
                <span className="text-slate-400">Trial Ends</span>
                <span className="font-medium text-amber-400">{date(s.trial_ends_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Doors Card */}
        <div className="rounded-xl border border-[#1E293B] p-6" style={{ backgroundColor: '#0B1121' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg p-2" style={{ backgroundColor: '#ffffff10' }}>
              <DoorOpen className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Active Doors</div>
              <div className="text-xl font-bold text-white">{activeDoors.toLocaleString()} <span className="text-sm font-normal text-slate-500">/ {doorsLimit.toLocaleString()} limit</span></div>
            </div>
          </div>
          <div className="mb-2 h-3 w-full rounded-full bg-[#1E293B]">
            <div
              className="h-3 rounded-full transition-all"
              style={{
                width: `${doorUsagePct}%`,
                backgroundColor: doorUsagePct >= 90 ? '#EF4444' : doorUsagePct >= 75 ? '#F59E0B' : '#10B981',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{doorUsagePct}% used</span>
            {isOverLimit && <span className="text-red-400">Overage: {overageDoors} doors</span>}
          </div>
        </div>

        {/* Current Charge Card */}
        <div className="rounded-xl border border-[#1E293B] p-6" style={{ backgroundColor: '#0B1121' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg p-2" style={{ backgroundColor: '#ffffff10' }}>
              <Receipt className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Current Month</div>
              <div className="text-xl font-bold text-white">{money(projectedTotal)}</div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Base Plan</span>
              <span className="font-medium text-white">{money(monthlyPrice)}</span>
            </div>
            {isOverLimit && (
              <div className="flex justify-between">
                <span className="text-slate-400">Door Overage ({overageDoors} doors)</span>
                <span className="font-medium text-red-400">{money(doorOverageCharge)}</span>
              </div>
            )}
            <div className="border-t border-[#1E293B] pt-2 flex justify-between font-semibold">
              <span className="text-white">Total</span>
              <span className="text-white">{money(projectedTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/company-admin/platform-requests/new"
          className="inline-flex items-center gap-2 rounded-lg border border-[#1E293B] px-4 py-2.5 text-sm font-medium text-emerald-400 hover:bg-white/5"
          style={{ backgroundColor: '#0B1121' }}
        >
          <DoorOpen className="h-4 w-4" /> Request More Doors
        </Link>
        <Link
          href="/company-admin/platform-requests/new"
          className="inline-flex items-center gap-2 rounded-lg border border-[#1E293B] px-4 py-2.5 text-sm font-medium text-emerald-400 hover:bg-white/5"
          style={{ backgroundColor: '#0B1121' }}
        >
          <TrendingUp className="h-4 w-4" /> Request Plan Upgrade
        </Link>
        <Link
          href="/company-admin/platform-requests/new"
          className="inline-flex items-center gap-2 rounded-lg border border-[#1E293B] px-4 py-2.5 text-sm font-medium text-emerald-400 hover:bg-white/5"
          style={{ backgroundColor: '#0B1121' }}
        >
          <Receipt className="h-4 w-4" /> Billing Review
        </Link>
      </div>

      {/* Projected Next Invoice */}
      <div className="rounded-xl border border-[#1E293B] p-6" style={{ backgroundColor: '#0B1121' }}>
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="h-5 w-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-white">Projected Next Invoice</h2>
        </div>
        <div className="text-3xl font-bold text-white">{money(projectedTotal)}</div>
        <div className="text-sm mt-1 text-slate-400">
          {s.current_period_end ? `Due ${date(s.current_period_end)}` : 'N/A'}
        </div>
      </div>

      {/* Payment Method */}
      <div className="rounded-xl border border-[#1E293B] p-6" style={{ backgroundColor: '#0B1121' }}>
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Payment Method</h2>
        </div>
        <div className="text-sm text-slate-400">
          {s.stripe_customer_id
            ? 'Payment method on file via Stripe'
            : 'No payment method configured'}
        </div>
        {s.billing_email && (
          <div className="mt-2 text-xs text-slate-500">Billing contact: {s.billing_email}</div>
        )}
        {s.stripe_subscription_id && (
          <div className="mt-1 text-xs text-slate-600">Subscription ID: {s.stripe_subscription_id}</div>
        )}
      </div>

      {/* Invoice History */}
      <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <div className="flex items-center justify-between border-b border-[#1E293B] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Invoice History</h2>
            <p className="mt-0.5 text-xs text-slate-500">Recent invoices for your portfolio</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
                <th className="px-4 py-3 text-left font-medium">Invoice #</th>
                <th className="px-4 py-3 text-left font-medium">Period</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {(invoices ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <BarChart3 className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                    <div className="text-sm text-slate-400">No invoices yet</div>
                    <div className="mt-1 text-xs text-slate-600">Invoices are generated at the end of each billing period</div>
                  </td>
                </tr>
              ) : (
                (invoices ?? []).map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-300">{inv.number ?? `INV-${inv.id?.slice(0, 8)}`}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {inv.period_start && inv.period_end
                        ? `${date(inv.period_start)} – ${date(inv.period_end)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-white font-medium">
                      {money(inv.total_cents)}
                    </td>
                    <td className="px-4 py-3">
                      {inv.status === 'paid' ? (
                        <span className="inline-flex h-6 items-center rounded-full bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">Paid</span>
                      ) : inv.status === 'open' ? (
                        <span className="inline-flex h-6 items-center rounded-full bg-amber-500/10 px-2.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">Open</span>
                      ) : inv.status === 'void' ? (
                        <span className="inline-flex h-6 items-center rounded-full bg-slate-500/10 px-2.5 text-xs font-medium text-slate-400 ring-1 ring-slate-500/20">Void</span>
                      ) : (
                        <span className="text-slate-400 capitalize">{inv.status ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inv.stripe_invoice_url ? (
                        <a
                          href={inv.stripe_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                        >
                          <FileText className="h-3 w-3" /> View PDF
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
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
