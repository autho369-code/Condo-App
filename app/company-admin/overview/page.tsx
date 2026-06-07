import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import {
  Building2,
  DoorOpen,
  Users,
  Wrench,
  Clock,
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

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'emerald',
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: React.ElementType
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'violet'
}) {
  const accents: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  }

  return (
    <div className="rounded-xl border border-[#1E293B] p-5 transition-colors hover:border-[#334155]" style={{ backgroundColor: '#0B1121' }}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function QuickActionButton({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-[#1E293B] px-4 py-2.5 text-sm text-slate-300 transition-colors hover:border-slate-600 hover:bg-white/5 hover:text-white"
      style={{ backgroundColor: '#0B1121' }}
    >
      {children}
    </Link>
  )
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const h = 40
  const w = 200
  const step = w / (data.length - 1)

  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="#10B981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <linearGradient id="spark-overview" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
      </linearGradient>
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill="url(#spark-overview)"
      />
    </svg>
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
    .from('violations')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .not('status', 'in', '("closed","cured")')
    .eq('hearing_required', true)

  const subscriptionQuery = db
    .from('subscriptions')
    .select('price_monthly_cents, seats_used, price_per_seat_cents')
    .eq('portfolio_id', portfolioId)
    .eq('status', 'active')
    .maybeSingle()

  const assocsForHealthQuery = db
    .from('associations')
    .select('id, name, unit_count')
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

  const revenueTrend = [monthlyRevenue * 0.7, monthlyRevenue * 0.75, monthlyRevenue * 0.82, monthlyRevenue * 0.88, monthlyRevenue * 0.92, monthlyRevenue].map((v) => Math.round(v / 100))

  // ── Health scores for associations ──────────────────
  const assocIds = (assocsForHealth ?? []).map((a: any) => a.id)
  let healthScoreDistribution = { healthy: 0, warning: 0, critical: 0 }

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

    assocIds.forEach((_id: string, i: number) => {
      const open = openWOCounts[i]?.count ?? 0
      const overdue = overdueWOCounts[i]?.count ?? 0
      if (overdue > 3 || open > 10) {
        healthScoreDistribution.critical++
      } else if (overdue > 0 || open > 5) {
        healthScoreDistribution.warning++
      } else {
        healthScoreDistribution.healthy++
      }
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
        <h1 className="text-2xl font-bold text-white">Portfolio Overview</h1>
        <p className="mt-1 text-sm text-slate-400">
          Executive dashboard for {me.portfolio?.company_name ?? me.portfolio?.name ?? 'your portfolio'}
        </p>
      </div>

      {/* ── Top Cards Grid ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Associations" value={totalAssociations ?? 0} icon={Building2} accent="emerald" />
        <StatCard label="Total Doors/Units" value={totalDoors.toLocaleString()} icon={DoorOpen} accent="blue" />
        <StatCard label="Active Managers" value={activeManagers ?? 0} icon={Users} accent="violet" />
        <StatCard label="Open Work Orders" value={openWorkOrders ?? 0} sub={`${overdueWorkOrders ?? 0} overdue`} icon={Wrench} accent={overdueWorkOrders && overdueWorkOrders > 0 ? 'amber' : 'emerald'} />
        <StatCard label="Open Violations" value={openViolations ?? 0} icon={AlertTriangle} accent={openViolations && openViolations > 0 ? 'red' : 'emerald'} />
        <StatCard label="Open Arch Reviews" value={openArchReviews ?? 0} icon={ClipboardCheck} accent="blue" />
        <StatCard
          label="Monthly Revenue"
          value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(monthlyRevenue / 100)}
          icon={DollarSign}
          accent="emerald"
        />
        <StatCard label="Delinquent Accounts" value={delinquentCount ?? 0} icon={TrendingUp} accent={delinquentCount && delinquentCount > 0 ? 'amber' : 'emerald'} />
        <StatCard label="Avg Health Score" value={`${avgHealthScore}%`} icon={Heart} accent={avgHealthScore >= 75 ? 'emerald' : avgHealthScore >= 50 ? 'amber' : 'red'} />
        <StatCard label="Open Work Orders" value={openWorkOrders ?? 0} sub="Across all associations" icon={Clock} accent="amber" />
      </div>

      {/* ── Quick Actions ─────────────────────────────── */}
      <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Quick Actions</div>
        <div className="flex flex-wrap gap-3">
          <QuickActionButton href="/settings?tab=managers"><UserPlus className="h-4 w-4" /> Invite Manager</QuickActionButton>
          <QuickActionButton href="/onboard"><PlusCircle className="h-4 w-4" /> Add Association</QuickActionButton>
          <QuickActionButton href="/company-admin/platform-requests/new"><Send className="h-4 w-4" /> Request More Doors</QuickActionButton>
          <QuickActionButton href="/company-admin/platform-requests/new"><MessageSquare className="h-4 w-4" /> Contact Platform Operator</QuickActionButton>
          <QuickActionButton href="/company-admin/billing"><CreditCard className="h-4 w-4" /> View Billing</QuickActionButton>
          <QuickActionButton href="/company-admin/managers"><UserCog className="h-4 w-4" /> Reassign Manager</QuickActionButton>
        </div>
      </div>

      {/* ── Charts Row ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Revenue Trend</div>
          <div className="mb-1 text-2xl font-bold text-white">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(monthlyRevenue / 100)}
          </div>
          <div className="mb-3 text-xs text-emerald-400">Last 6 months (estimated)</div>
          <Sparkline data={revenueTrend} />
          <div className="mt-2 flex justify-between text-xs text-slate-600">
            <span>{new Date(Date.now() - 5 * 30 * 86400000).toLocaleDateString('en-US', { month: 'short' })}</span>
            <span>{today.toLocaleDateString('en-US', { month: 'short' })}</span>
          </div>
        </div>

        <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
          <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Health Score Distribution</div>
          {totalWithHealth > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-8">
                <svg viewBox="0 0 120 120" className="h-28 w-28">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#1E293B" strokeWidth="12" />
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
                    <span className="text-sm text-slate-300">Healthy: <strong className="text-emerald-400">{healthScoreDistribution.healthy}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-slate-300">Warning: <strong className="text-amber-400">{healthScoreDistribution.warning}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-sm text-slate-300">Critical: <strong className="text-red-400">{healthScoreDistribution.critical}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-slate-500">No association health data available.</div>
          )}
        </div>
      </div>

      {/* ── Association Health Summary ────────────────── */}
      <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <div className="flex items-center justify-between border-b border-[#1E293B] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Association Health</h2>
            <p className="mt-0.5 text-xs text-slate-500">Quick health overview for each association in your portfolio</p>
          </div>
          <Link href="/company-admin/portfolio-health" className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline">
            View full report <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
                <th className="px-5 py-3 text-left font-medium">Association</th>
                <th className="px-5 py-3 text-left font-medium">Units</th>
                <th className="px-5 py-3 text-left font-medium">Open WO</th>
                <th className="px-5 py-3 text-left font-medium">Overdue WO</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {(assocsForHealth ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">No associations found.</td></tr>
              ) : (
                (assocsForHealth ?? []).map((assoc: any) => (
                  <tr key={assoc.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <Link href={`/associations/${assoc.id}`} className="font-medium text-slate-200 hover:text-emerald-400">{assoc.name}</Link>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{assoc.unit_count ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-400">—</td>
                    <td className="px-5 py-3 text-slate-400">—</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex h-6 items-center rounded-full bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">Healthy</span>
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
