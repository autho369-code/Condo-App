import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { DollarSign, TrendingUp, Home, AlertTriangle, ArrowDown } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

function fmtCents(cents: number | null | undefined): string {
  const n = (cents ?? 0) / 100
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
}) {
  return (
    <div className={`${card} px-4 py-3.5`}>
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
  )
}

export default async function RevenuePage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

  // ── Fetch management fees ────────────────────────────
  let feeRows: any[] = []
  try {
    const { data } = await db
      .from('management_fees')
      .select('*, associations!inner(id, name)')
      .eq('portfolio_id', portfolioId)
      .order('month', { ascending: false })
      .limit(500)
    feeRows = data ?? []
  } catch {
    feeRows = []
  }

  // Current month fees
  const currentMonthFees = feeRows.filter((f: any) => {
    if (!f.month) return false
    const m = typeof f.month === 'string' ? f.month.slice(0, 7) : f.month
    const cm = currentMonthStart.slice(0, 7)
    return m === cm
  })

  const totalCollectedCents = currentMonthFees.reduce((sum: number, f: any) => sum + (f.collected_cents ?? 0), 0)
  const totalFeeCents = currentMonthFees.reduce((sum: number, f: any) => sum + (f.fee_amount_cents ?? 0), 0)
  const totalDelinquentCents = currentMonthFees.reduce((sum: number, f: any) => sum + (f.delinquent_cents ?? 0), 0)
  const totalDoors = currentMonthFees.reduce((sum: number, f: any) => sum + (f.door_count ?? 0), 0)
  const avgPerDoor = totalDoors > 0 ? totalCollectedCents / totalDoors : 0

  // Revenue by association (current month)
  const assocRevenueMap = new Map<string, { name: string; collected: number; fee: number; delinquent: number; doors: number }>()
  for (const f of currentMonthFees) {
    const aId = f.association_id
    const aName = f.associations?.name ?? 'Unknown'
    if (!assocRevenueMap.has(aId)) {
      assocRevenueMap.set(aId, { name: aName, collected: 0, fee: 0, delinquent: 0, doors: 0 })
    }
    const entry = assocRevenueMap.get(aId)!
    entry.collected += f.collected_cents ?? 0
    entry.fee += f.fee_amount_cents ?? 0
    entry.delinquent += f.delinquent_cents ?? 0
    entry.doors += f.door_count ?? 0
  }
  const assocRevenueList = Array.from(assocRevenueMap.values()).sort((a, b) => b.collected - a.collected)

  // Last 6 months trend
  const last6Months: { label: string; collected: number; fee: number; key: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toISOString().slice(0, 7)
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const monthFees = feeRows.filter((f: any) => {
      if (!f.month) return false
      const m = typeof f.month === 'string' ? f.month.slice(0, 7) : f.month
      return m === key
    })
    const col = monthFees.reduce((s: number, f: any) => s + (f.collected_cents ?? 0), 0)
    const fee = monthFees.reduce((s: number, f: any) => s + (f.fee_amount_cents ?? 0), 0)
    last6Months.push({ label, collected: col / 100, fee: fee / 100, key })
  }
  const maxTrendVal = Math.max(1, ...last6Months.map((m) => m.collected))

  // Delinquency risk: associations where delinquent > 20% of fee amount
  const atRisk = assocRevenueList.filter((a) => a.fee > 0 && a.delinquent / a.fee > 0.2)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Revenue</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Company-wide revenue dashboard for {me.portfolio?.company_name ?? me.portfolio?.name ?? 'your portfolio'}
        </p>
      </div>

      {/* ── Stats Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Monthly Mgmt Fee Income"
          value={fmtCents(totalCollectedCents)}
          sub={`${currentMonthFees.length} association${currentMonthFees.length !== 1 ? 's' : ''}`}
          icon={DollarSign}
        />
        <StatCard
          label="Total Revenue MTD"
          value={fmtCents(totalCollectedCents)}
          sub={`${fmtCents(totalFeeCents)} expected`}
          icon={TrendingUp}
        />
        <StatCard
          label="Avg Revenue Per Door"
          value={fmtCents(avgPerDoor)}
          sub={`${totalDoors} total doors`}
          icon={Home}
        />
        <StatCard
          label="Total Delinquency"
          value={fmtCents(totalDelinquentCents)}
          sub={`${totalFeeCents > 0 ? Math.round((totalDelinquentCents / totalFeeCents) * 100) : 0}% of expected`}
          icon={AlertTriangle}
        />
      </div>

      {/* ── Revenue Trend ────────────────────────────── */}
      <div className={`${card} p-6`}>
        <h2 className="mb-4 text-sm font-semibold text-gray-950">Revenue Trend — Last 6 Months</h2>
        {last6Months.every((m) => m.collected === 0) ? (
          <div className="py-8 text-center text-sm text-gray-500">
            No management fee data recorded for the last 6 months.
          </div>
        ) : (
          <div className="flex h-48 items-end gap-3">
            {last6Months.map((m) => {
              const hPct = maxTrendVal > 0 ? (m.collected / maxTrendVal) * 100 : 0
              return (
                <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div className="text-xs tabular-nums text-gray-700">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(m.collected)}
                  </div>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(2, hPct)}%`,
                      backgroundColor: m.key === currentMonthStart.slice(0, 7) ? '#10B981' : '#E5E7EB',
                    }}
                  />
                  <span className="text-xs text-gray-500">{m.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Revenue by Association ───────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={`${card} p-6`}>
          <h2 className="mb-4 text-sm font-semibold text-gray-950">Revenue by Association</h2>
          {assocRevenueList.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No revenue data for this month.</div>
          ) : (
            <div className="space-y-4">
              {assocRevenueList.map((a) => {
                const maxCollected = assocRevenueList[0]?.collected ?? 1
                const barW = maxCollected > 0 ? Math.max(2, (a.collected / maxCollected) * 100) : 0
                return (
                  <div key={a.name}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="mr-2 truncate text-gray-700">{a.name}</span>
                      <span className="tabular-nums text-gray-950">{fmtCents(a.collected)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${barW}%` }} />
                    </div>
                    <div className="mt-0.5 flex justify-between text-xs text-gray-500">
                      <span>{a.doors} doors</span>
                      {a.delinquent > 0 && <span className="text-red-700">{fmtCents(a.delinquent)} delinquent</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Financial Risk ─────────────────────────── */}
        <div className={`${card} p-6`}>
          <h2 className="mb-4 text-sm font-semibold text-gray-950">
            Associations at Financial Risk
          </h2>
          {atRisk.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No associations at financial risk.</div>
          ) : (
            <div className="space-y-4">
              {atRisk.map((a) => {
                const riskPct = a.fee > 0 ? Math.round((a.delinquent / a.fee) * 100) : 0
                return (
                  <div key={a.name} className="rounded-xl border border-red-200/70 bg-red-50/40 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-gray-950">{a.name}</span>
                      <StatusChip tone="danger">{riskPct}% delinquent</StatusChip>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>Expected: {fmtCents(a.fee)}</span>
                      <span>Collected: {fmtCents(a.collected)}</span>
                      <span className="flex items-center gap-1 font-medium text-red-700">
                        <ArrowDown className="h-3 w-3" />
                        {fmtCents(a.delinquent)} at risk
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
