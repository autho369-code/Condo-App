import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { ACTIVE_VIOLATION_STATUSES } from '@/lib/violations/queries'
import {
  Building2,
  DoorOpen,
  Users,
  Wrench,
  AlertTriangle,
  ClipboardCheck,
  TrendingUp,
  DollarSign,
  Heart,
  ArrowRight,
  UserPlus,
  PlusCircle,
  Send,
  MessageSquare,
  CreditCard,
  UserCog,
  Siren,
  Banknote,
  UserCheck,
} from 'lucide-react'
import { todayInZone } from '@/lib/time/zoned'
import { Alert } from '@/components/ui/shell'
import { collectLoadErrors } from '@/lib/company-admin/load-errors'
import { computeAssociationHealth, healthTone, HEALTH_LABELS, OPEN_WORK_ORDER_STATUSES } from '@/lib/company-admin/health'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: React.ElementType
  tone?: 'danger' | 'warning'
}) {
  return (
    <div className={`${card} px-4 py-3.5`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[13px] font-medium leading-5 text-gray-500">{label}</div>
          <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${tone === 'danger' ? 'text-red-700' : tone === 'warning' ? 'text-amber-700' : 'text-gray-950'}`}>{value}</div>
          {sub && <div className="mt-1 text-[13px] text-gray-500">{sub}</div>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
      </div>
    </div>
  )
}

function QuickActionButton({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-gray-50 hover:text-gray-950"
    >
      {children}
    </Link>
  )
}

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)

export default async function OverviewPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  // Calendar dates are the company's zone (server code runs in UTC).
  const todayDate = todayInZone()
  const monthStart = `${todayDate.slice(0, 7)}-01`

  // ── Portfolio-wide queries (single round-trip each) ─────────────
  const [
    assocsRes,
    managersRes,
    ownersRes,
    openWOsRes,
    openViolsRes,
    archRes,
    subscriptionRes,
    feesRes,
    workloadRes,
  ] = await Promise.all([
    db.from('associations').select('id, slug, name, unit_count').eq('portfolio_id', portfolioId).is('archived_at', null),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('portfolio_id', portfolioId).in('hoa_role', ['manager', 'company_admin']),
    db.from('owners').select('id', { count: 'exact', head: true }).eq('portfolio_id', portfolioId).is('archived_at', null),
    fetchAllRows(() => db.from('work_orders').select('id, association_id, status, priority, scheduled_date').eq('portfolio_id', portfolioId).is('archived_at', null).in('status', [...OPEN_WORK_ORDER_STATUSES]).order('id')),
    fetchAllRows(() => db.from('violations').select('id, association_id').is('archived_at', null).in('status', [...ACTIVE_VIOLATION_STATUSES]).order('id')),
    db.from('architectural_requests').select('id', { count: 'exact', head: true }).eq('portfolio_id', portfolioId).in('status', ['submitted', 'under_review', 'more_info']),
    db.from('subscriptions').select('price_monthly_cents, seats_used, price_per_seat_cents').eq('portfolio_id', portfolioId).eq('status', 'active').maybeSingle(),
    db.from('management_fees').select('fee_amount_cents, collected_cents').eq('portfolio_id', portfolioId).eq('month', monthStart),
    db.from('v_manager_workload').select('*'),
  ])
  const assocs = assocsRes.data as any[] | null
  const activeManagers = managersRes.count as number | null
  const activeOwners = ownersRes.count as number | null
  const openWOs = openWOsRes.rows as any[]
  const openViols = openViolsRes.rows as any[]
  const openArchReviews = archRes.count as number | null
  const subscription = subscriptionRes.data
  const feesThisMonth = feesRes.data as any[] | null
  const workload = workloadRes.data as any[] | null

  const assocIds = new Set((assocs ?? []).map((a: any) => a.id))
  const totalAssociations = (assocs ?? []).length
  const totalDoors = (assocs ?? []).reduce((sum: number, a: any) => sum + (a.unit_count ?? 0), 0)

  // ── Health per association (shared formula, lib/company-admin/health) ──
  const assocHealth = computeAssociationHealth(assocIds, openWOs, openViols, todayDate)
  let openWorkOrders = 0
  let overdueWorkOrders = 0
  let criticalEmergencies = 0
  let openViolations = 0
  const distribution = { healthy: 0, warning: 0, critical: 0 }
  for (const h of assocHealth.values()) {
    openWorkOrders += h.open
    overdueWorkOrders += h.overdue
    criticalEmergencies += h.emergency
    openViolations += h.violations
    distribution[h.status]++
  }
  const totalWithHealth = distribution.healthy + distribution.warning + distribution.critical
  const avgHealthScore = totalWithHealth > 0
    ? Math.round([...assocHealth.values()].reduce((s, h) => s + h.score, 0) / totalWithHealth)
    : 0

  // ── Collections balance (A/R across the portfolio) ─────────────
  const balancesRes = assocIds.size > 0
    ? await fetchAllRows(() => db.from('unit_balances').select('unit_id, association_id, balance').in('association_id', [...assocIds]).order('unit_id'))
    : { rows: [] as any[], truncated: false, error: null }
  const balances = balancesRes.rows
  const collectionsBalance = (balances ?? []).reduce(
    (sum: number, b: any) => sum + Math.max(0, Number(b.balance ?? 0)), 0)
  // Delinquent accounts = units with an open charge past due (the
  // delinquent_units view), not every unit carrying a balance: current or
  // future charges are owed but not delinquent.
  const delinquentRes = assocIds.size > 0
    ? await fetchAllRows(() => db.from('delinquent_units').select('unit_id').in('association_id', [...assocIds]).order('unit_id'))
    : { rows: [] as any[], truncated: false, error: null }
  const delinquentUnits = new Set((delinquentRes.rows ?? []).map((r: any) => r.unit_id)).size
  const unitsWithBalance = (balances ?? []).filter((b: any) => Number(b.balance ?? 0) > 0).length

  // ── Monthly revenue: management fees first, subscription as context ──
  const feeRevenueCents = (feesThisMonth ?? []).reduce((s: number, f: any) => s + (f.collected_cents ?? 0), 0)
  const feeBilledCents = (feesThisMonth ?? []).reduce((s: number, f: any) => s + (f.fee_amount_cents ?? 0), 0)
  const platformCostCents = subscription
    ? (subscription.price_monthly_cents ?? 0) + (subscription.seats_used ?? 0) * (subscription.price_per_seat_cents ?? 0)
    : 0

  const loadErrors = collectLoadErrors({
    Associations: assocsRes,
    Managers: managersRes,
    Owners: ownersRes,
    'Work orders': openWOsRes,
    Violations: openViolsRes,
    'Architectural reviews': archRes,
    Subscription: subscriptionRes,
    'Management fees': feesRes,
    'Manager workload': workloadRes,
    Balances: balancesRes,
    'Delinquent units': delinquentRes,
  })

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────── */}
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Executive Dashboard</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">
          Command center for {me.portfolio?.company_name ?? me.portfolio?.name ?? 'your portfolio'}
        </p>
      </div>

      {loadErrors.length > 0 && (
        <Alert tone="danger" title="Some dashboard data could not be loaded; figures below may be incomplete.">{loadErrors.join(' · ')}</Alert>
      )}

      {/* ── Top Cards Grid ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Total Associations" value={totalAssociations} icon={Building2} />
        <StatCard label="Total Units (Doors)" value={totalDoors.toLocaleString()} icon={DoorOpen} />
        <StatCard label="Total Managers" value={activeManagers ?? 0} icon={Users} />
        <StatCard label="Active Owners" value={activeOwners ?? 0} icon={UserCheck} />
        <StatCard label="Open Work Orders" value={openWorkOrders} sub={`${overdueWorkOrders} overdue`} icon={Wrench} tone={overdueWorkOrders > 0 ? 'warning' : undefined} />
        <StatCard label="Open Violations" value={openViolations} icon={AlertTriangle} />
        <StatCard label="Critical Emergencies" value={criticalEmergencies} icon={Siren} tone={criticalEmergencies > 0 ? 'danger' : undefined} />
        <StatCard label="Open Arch Reviews" value={openArchReviews ?? 0} icon={ClipboardCheck} />
        <StatCard label="Collections Balance" value={usd(collectionsBalance)} sub={`${unitsWithBalance} unit${unitsWithBalance === 1 ? '' : 's'} with balance`} icon={Banknote} tone={collectionsBalance > 0 ? 'warning' : undefined} />
        <StatCard
          label="Monthly Revenue"
          value={usd(feeRevenueCents / 100)}
          sub={feeBilledCents > 0 ? `${usd(feeBilledCents / 100)} billed in mgmt fees` : platformCostCents > 0 ? `Platform cost ${usd(platformCostCents / 100)}/mo` : 'No management fees recorded this month'}
          icon={DollarSign}
        />
        <StatCard label="Delinquent Accounts" value={delinquentRes.error ? '—' : delinquentUnits} sub="Units with a charge past due" icon={TrendingUp} tone={delinquentUnits > 0 ? 'warning' : undefined} />
        <StatCard label="Avg Health Score" value={`${avgHealthScore}%`} icon={Heart} />
      </div>

      {/* ── Quick Actions ─────────────────────────────── */}
      <div className={`${card} p-5`}>
        <div className="mb-3 text-[13px] font-semibold text-gray-700">Quick Actions</div>
        <div className="flex flex-wrap gap-3">
          <QuickActionButton href="/company-admin/managers"><UserPlus className="h-4 w-4 text-gray-400" /> Invite Manager</QuickActionButton>
          <QuickActionButton href="/onboard"><PlusCircle className="h-4 w-4 text-gray-400" /> Add Association</QuickActionButton>
          <QuickActionButton href="/company-admin/financials"><DollarSign className="h-4 w-4 text-gray-400" /> Financial Oversight</QuickActionButton>
          <QuickActionButton href="/company-admin/performance"><TrendingUp className="h-4 w-4 text-gray-400" /> Manager Performance</QuickActionButton>
          <QuickActionButton href="/company-admin/platform-requests"><Send className="h-4 w-4 text-gray-400" /> Request More Doors</QuickActionButton>
          <QuickActionButton href="/company-admin/platform-requests"><MessageSquare className="h-4 w-4 text-gray-400" /> Contact Platform Operator</QuickActionButton>
          <QuickActionButton href="/company-admin/billing"><CreditCard className="h-4 w-4 text-gray-400" /> View Billing</QuickActionButton>
          <QuickActionButton href="/company-admin/managers"><UserCog className="h-4 w-4 text-gray-400" /> Reassign Manager</QuickActionButton>
        </div>
      </div>

      {/* ── Manager Workload ──────────────────────────── */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Manager Workload</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">Assigned properties and open work per manager</p>
          </div>
          <Link href="/company-admin/performance" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline">
            Performance rankings <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Manager</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Properties</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Doors</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Open WO</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Overdue</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Violations</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">ARC</th>
              </tr>
            </thead>
            <tbody>
              {(workload ?? []).length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">No managers with assigned properties yet. Managers with full-portfolio access appear once they are scoped to specific associations.</td></tr>
              ) : (
                (workload ?? []).map((w: any) => (
                  <tr key={w.manager_id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                    <td className="px-5 py-3.5">
                      <Link href={`/company-admin/managers/${w.manager_id}`} className="font-medium text-gray-900 hover:underline">{w.manager_name ?? w.manager_email}</Link>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{w.assigned_associations}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{Number(w.total_doors_managed ?? 0).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{w.open_work_orders}</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${w.overdue_work_orders > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>{w.overdue_work_orders}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{w.open_violations}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{w.open_arch_reviews}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Health Distribution ───────────────────────── */}
      <div className="grid grid-cols-1 gap-4">
        <div className={`${card} p-5`}>
          <div className="mb-4 text-[13px] font-semibold text-gray-700">Health Score Distribution</div>
          {totalWithHealth > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-8">
                <svg viewBox="0 0 120 120" className="h-28 w-28">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#F3F4F6" strokeWidth="12" />
                  {(() => {
                    const healthyPct = distribution.healthy / totalWithHealth
                    const warningPct = distribution.warning / totalWithHealth
                    const criticalPct = distribution.critical / totalWithHealth
                    const healthyLen = healthyPct * 314
                    const warningLen = warningPct * 314
                    const criticalLen = criticalPct * 314
                    return (
                      <>
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#10B981" strokeWidth="12" strokeDasharray={`${healthyLen} ${314 - healthyLen}`} strokeDashoffset="0" strokeLinecap="round" />
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#F59E0B" strokeWidth="12" strokeDasharray={`${warningLen} ${314 - warningLen}`} strokeDashoffset={-(healthyLen)} strokeLinecap="round" />
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#EF4444" strokeWidth="12" strokeDasharray={`${criticalLen} ${314 - criticalLen}`} strokeDashoffset={-(healthyLen + warningLen)} strokeLinecap="round" />
                      </>
                    )
                  })()}
                </svg>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span className="text-sm text-gray-700">Healthy: <strong className="text-gray-950">{distribution.healthy}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-gray-700">Warning: <strong className="text-gray-950">{distribution.warning}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-sm text-gray-700">Critical: <strong className="text-gray-950">{distribution.critical}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-gray-500">No association health data available.</div>
          )}
        </div>
      </div>

      {/* ── Association Health + AI Score ─────────────── */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Property Health Scores</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">Live health score per association — computed from open work, overdue items, emergencies, and violations</p>
          </div>
          <Link href="/company-admin/portfolio-health" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline">
            View full report <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Association</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Units</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Open WO</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Overdue</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Violations</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Health Score</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(assocs ?? []).length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">No associations found.</td></tr>
              ) : (
                (assocs ?? []).map((assoc: any) => {
                  const h = assocHealth.get(assoc.id)
                  const status = h?.status ?? 'healthy'
                  const tone = healthTone(status)
                  const label = HEALTH_LABELS[status]
                  return (
                    <tr key={assoc.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                      <td className="px-5 py-3.5">
                        <Link href={`/associations/${assoc.slug ?? assoc.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{assoc.name}</Link>
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{assoc.unit_count ?? '—'}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{h?.open ?? 0}</td>
                      <td className={`px-5 py-3 text-right tabular-nums ${(h?.overdue ?? 0) > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>{h?.overdue ?? 0}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{h?.violations ?? 0}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-semibold tabular-nums ${(h?.score ?? 100) >= 80 ? 'text-emerald-700' : (h?.score ?? 100) >= 50 ? 'text-amber-700' : 'text-red-700'}`}>{h?.score ?? 100}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusChip tone={tone}>{label}</StatusChip>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
