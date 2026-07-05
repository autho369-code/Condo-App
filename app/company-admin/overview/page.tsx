import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
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
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
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

export default async function OverviewPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const today = new Date()
  const todayDate = today.toISOString().slice(0, 10)

  // ── Top cards queries ──────────────────────────────────
  const totalAssocQuery = db
    .from('associations')
    .select('id', { count: 'exact', head: true })
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)

  const totalDoorsQuery = db
    .from('associations')
    .select('unit_count')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)

  const activeManagersQuery = db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('portfolio_id', portfolioId)
    .in('hoa_role', ['manager', 'company_admin'])

  const openWorkOrdersQuery = db
    .from('work_orders')
    .select('id', { count: 'exact', head: true })
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .not('status', 'in', '("completed","closed","cancelled")')

  const overdueWorkOrdersQuery = db
    .from('work_orders')
    .select('id', { count: 'exact', head: true })
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .not('status', 'in', '("completed","closed","cancelled")')
    .lt('scheduled_date', todayDate)

  const openViolationsQuery = db
    .from('violations')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .not('status', 'in', '("closed","cured")')

  const openArchReviewsQuery = db
    .from('architectural_requests')
    .select('id', { count: 'exact', head: true })
    .eq('portfolio_id', portfolioId)
    .in('status', ['submitted', 'under_review', 'more_info'])

  const subscriptionQuery = db
    .from('subscriptions')
    .select('price_monthly_cents, seats_used, price_per_seat_cents')
    .eq('portfolio_id', portfolioId)
    .eq('status', 'active')
    .maybeSingle()

  const assocsForHealthQuery = db
    .from('associations')
    .select('id, slug, name, unit_count')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)

  const [
    { count: totalAssociations },
    { data: doorsData },
    { count: activeManagers },
    { count: openWorkOrders },
    { count: overdueWorkOrders },
    { count: openViolations },
    { count: openArchReviews },
    { data: subscription },
    { data: assocsForHealth },
  ] = await Promise.all([
    totalAssocQuery,
    totalDoorsQuery,
    activeManagersQuery,
    openWorkOrdersQuery,
    overdueWorkOrdersQuery,
    openViolationsQuery,
    openArchReviewsQuery,
    subscriptionQuery,
    assocsForHealthQuery,
  ])

  const totalDoors = (doorsData ?? []).reduce(
    (sum: number, a: any) => sum + (a.unit_count ?? 0),
    0,
  )

  let monthlyRevenue = 0
  if (subscription) {
    monthlyRevenue =
      (subscription.price_monthly_cents ?? 0) +
      (subscription.seats_used ?? 0) * (subscription.price_per_seat_cents ?? 0)
  }

  // ── Health scores for associations ──────────────────
  const assocIds = (assocsForHealth ?? []).map((a: any) => a.id)
  let healthScoreDistribution = { healthy: 0, warning: 0, critical: 0 }
  // Per-association open/overdue WO counts + health status, keyed by association id.
  const assocHealth = new Map<string, { open: number; overdue: number; status: 'healthy' | 'warning' | 'critical' }>()

  if (assocIds.length > 0) {
    const openWOCounts = await Promise.all(
      assocIds.map((id: string) =>
        db
          .from('work_orders')
          .select('id', { count: 'exact', head: true })
          .eq('association_id', id)
          .is('archived_at', null)
          .not('status', 'in', '("completed","closed","cancelled")')
      ),
    )

    const overdueWOCounts = await Promise.all(
      assocIds.map((id: string) =>
        db
          .from('work_orders')
          .select('id', { count: 'exact', head: true })
          .eq('association_id', id)
          .is('archived_at', null)
          .not('status', 'in', '("completed","closed","cancelled")')
          .lt('scheduled_date', todayDate)
      ),
    )

    assocIds.forEach((id: string, i: number) => {
      const open = openWOCounts[i]?.count ?? 0
      const overdue = overdueWOCounts[i]?.count ?? 0
      let status: 'healthy' | 'warning' | 'critical'
      if (overdue > 3 || open > 10) {
        status = 'critical'
        healthScoreDistribution.critical++
      } else if (overdue > 0 || open > 5) {
        status = 'warning'
        healthScoreDistribution.warning++
      } else {
        status = 'healthy'
        healthScoreDistribution.healthy++
      }
      assocHealth.set(id, { open, overdue, status })
    })
  }

  const totalWithHealth =
    healthScoreDistribution.healthy +
    healthScoreDistribution.warning +
    healthScoreDistribution.critical
  const avgHealthScore =
    totalWithHealth > 0
      ? Math.round(
          (healthScoreDistribution.healthy * 100 +
            healthScoreDistribution.warning * 50 +
            healthScoreDistribution.critical * 0) /
            totalWithHealth,
        )
      : 0

  // ── Delinquent accounts ────────────────────────────
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()
  const { count: delinquentCount } = await db
    .from('occupancies')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'current')
    .lt('dues_paid_through', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────── */}
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Portfolio Overview</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Executive dashboard for {me.portfolio?.company_name ?? me.portfolio?.name ?? 'your portfolio'}
        </p>
      </div>

      {/* ── Top Cards Grid ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Associations" value={totalAssociations ?? 0} icon={Building2} />
        <StatCard label="Total Doors/Units" value={totalDoors.toLocaleString()} icon={DoorOpen} />
        <StatCard label="Active Managers" value={activeManagers ?? 0} icon={Users} />
        <StatCard label="Open Work Orders" value={openWorkOrders ?? 0} sub={`${overdueWorkOrders ?? 0} overdue`} icon={Wrench} />
        <StatCard label="Open Violations" value={openViolations ?? 0} icon={AlertTriangle} />
        <StatCard label="Open Arch Reviews" value={openArchReviews ?? 0} icon={ClipboardCheck} />
        <StatCard
          label="Monthly Revenue"
          value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(monthlyRevenue / 100)}
          icon={DollarSign}
        />
        <StatCard label="Delinquent Accounts" value={delinquentCount ?? 0} icon={TrendingUp} />
        <StatCard label="Avg Health Score" value={`${avgHealthScore}%`} icon={Heart} />
      </div>

      {/* ── Quick Actions ─────────────────────────────── */}
      <div className={`${card} p-5`}>
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Quick Actions</div>
        <div className="flex flex-wrap gap-3">
          <QuickActionButton href="/settings?tab=managers"><UserPlus className="h-4 w-4 text-gray-400" /> Invite Manager</QuickActionButton>
          <QuickActionButton href="/onboard"><PlusCircle className="h-4 w-4 text-gray-400" /> Add Association</QuickActionButton>
          <QuickActionButton href="/company-admin/platform-requests"><Send className="h-4 w-4 text-gray-400" /> Request More Doors</QuickActionButton>
          <QuickActionButton href="/company-admin/platform-requests"><MessageSquare className="h-4 w-4 text-gray-400" /> Contact Platform Operator</QuickActionButton>
          <QuickActionButton href="/company-admin/billing"><CreditCard className="h-4 w-4 text-gray-400" /> View Billing</QuickActionButton>
          <QuickActionButton href="/company-admin/managers"><UserCog className="h-4 w-4 text-gray-400" /> Reassign Manager</QuickActionButton>
        </div>
      </div>

      {/* ── Charts Row ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4">
        <div className={`${card} p-5`}>
          <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Health Score Distribution</div>
          {totalWithHealth > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-8">
                <svg viewBox="0 0 120 120" className="h-28 w-28">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#F3F4F6" strokeWidth="12" />
                  {(() => {
                    const healthyPct = totalWithHealth > 0 ? healthScoreDistribution.healthy / totalWithHealth : 0
                    const warningPct = totalWithHealth > 0 ? healthScoreDistribution.warning / totalWithHealth : 0
                    const criticalPct = totalWithHealth > 0 ? healthScoreDistribution.critical / totalWithHealth : 0
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
                    <span className="text-sm text-gray-700">Healthy: <strong className="text-gray-950">{healthScoreDistribution.healthy}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-gray-700">Warning: <strong className="text-gray-950">{healthScoreDistribution.warning}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-sm text-gray-700">Critical: <strong className="text-gray-950">{healthScoreDistribution.critical}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-gray-500">No association health data available.</div>
          )}
        </div>
      </div>

      {/* ── Association Health Summary ────────────────── */}
      <div className={card}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Association Health</h2>
            <p className="mt-0.5 text-xs text-gray-500">Quick health overview for each association in your portfolio</p>
          </div>
          <Link href="/company-admin/portfolio-health" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline">
            View full report <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Association</th>
                <th className="px-5 py-2.5 text-left font-medium">Units</th>
                <th className="px-5 py-2.5 text-left font-medium">Open WO</th>
                <th className="px-5 py-2.5 text-left font-medium">Overdue WO</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(assocsForHealth ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">No associations found.</td></tr>
              ) : (
                (assocsForHealth ?? []).map((assoc: any) => {
                  const h = assocHealth.get(assoc.id)
                  const open = h?.open ?? 0
                  const overdue = h?.overdue ?? 0
                  const status = h?.status ?? 'healthy'
                  const tone = status === 'critical' ? 'danger' : status === 'warning' ? 'warning' : 'success'
                  const label = status === 'critical' ? 'Critical' : status === 'warning' ? 'Warning' : 'Healthy'
                  return (
                    <tr key={assoc.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-5 py-3">
                        <Link href={`/associations/${assoc.slug ?? assoc.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{assoc.name}</Link>
                      </td>
                      <td className="px-5 py-3 tabular-nums text-gray-700">{assoc.unit_count ?? '—'}</td>
                      <td className="px-5 py-3 tabular-nums text-gray-700">{open}</td>
                      <td className={`px-5 py-3 tabular-nums ${overdue > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>{overdue}</td>
                      <td className="px-5 py-3">
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
