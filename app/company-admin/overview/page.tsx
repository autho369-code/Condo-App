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
  Siren,
  Banknote,
  UserCheck,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
const OPEN_WO_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress']

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
          <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
          <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${tone === 'danger' ? 'text-red-700' : tone === 'warning' ? 'text-amber-700' : 'text-gray-950'}`}>{value}</div>
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

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)

export default async function OverviewPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const today = new Date()
  const todayDate = today.toISOString().slice(0, 10)
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

  // ── Portfolio-wide queries (single round-trip each) ─────────────
  const [
    { data: assocs },
    { count: activeManagers },
    { count: activeOwners },
    { data: openWOs },
    { data: openViols },
    { count: openArchReviews },
    { data: subscription },
    { data: feesThisMonth },
    { data: workload },
  ] = await Promise.all([
    db.from('associations').select('id, slug, name, unit_count').eq('portfolio_id', portfolioId).is('archived_at', null),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('portfolio_id', portfolioId).in('hoa_role', ['manager', 'company_admin']),
    db.from('owners').select('id', { count: 'exact', head: true }).eq('portfolio_id', portfolioId).is('archived_at', null),
    db.from('work_orders').select('association_id, status, priority, scheduled_date').eq('portfolio_id', portfolioId).is('archived_at', null).in('status', OPEN_WO_STATUSES),
    db.from('violations').select('association_id').is('archived_at', null).not('status', 'in', '("closed","cured","violation_dismissed")'),
    db.from('architectural_requests').select('id', { count: 'exact', head: true }).eq('portfolio_id', portfolioId).in('status', ['submitted', 'under_review', 'more_info']),
    db.from('subscriptions').select('price_monthly_cents, seats_used, price_per_seat_cents').eq('portfolio_id', portfolioId).eq('status', 'active').maybeSingle(),
    db.from('management_fees').select('fee_amount_cents, collected_cents').eq('portfolio_id', portfolioId).eq('month', monthStart),
    db.from('v_manager_workload').select('*'),
  ])

  const assocIds = new Set((assocs ?? []).map((a: any) => a.id))
  const totalAssociations = (assocs ?? []).length
  const totalDoors = (assocs ?? []).reduce((sum: number, a: any) => sum + (a.unit_count ?? 0), 0)

  // ── Per-association aggregation from the single WO/violation fetches ──
  const woByAssoc = new Map<string, { open: number; overdue: number; emergency: number }>()
  let openWorkOrders = 0
  let overdueWorkOrders = 0
  let criticalEmergencies = 0
  for (const wo of openWOs ?? []) {
    openWorkOrders++
    const entry = woByAssoc.get(wo.association_id) ?? { open: 0, overdue: 0, emergency: 0 }
    entry.open++
    if (wo.scheduled_date && wo.scheduled_date < todayDate) { entry.overdue++; overdueWorkOrders++ }
    if (wo.priority === 'emergency') { entry.emergency++; criticalEmergencies++ }
    woByAssoc.set(wo.association_id, entry)
  }

  const violByAssoc = new Map<string, number>()
  let openViolations = 0
  for (const v of openViols ?? []) {
    if (!assocIds.has(v.association_id)) continue
    openViolations++
    violByAssoc.set(v.association_id, (violByAssoc.get(v.association_id) ?? 0) + 1)
  }

  // ── Collections balance (A/R across the portfolio) ─────────────
  const { data: balances } = assocIds.size > 0
    ? await db.from('unit_balances').select('association_id, balance').in('association_id', [...assocIds])
    : { data: [] as any[] }
  const collectionsBalance = (balances ?? []).reduce(
    (sum: number, b: any) => sum + Math.max(0, Number(b.balance ?? 0)), 0)
  const unitsWithBalance = (balances ?? []).filter((b: any) => Number(b.balance ?? 0) > 0).length

  // ── Monthly revenue: management fees first, subscription as context ──
  const feeRevenueCents = (feesThisMonth ?? []).reduce((s: number, f: any) => s + (f.collected_cents ?? 0), 0)
  const feeBilledCents = (feesThisMonth ?? []).reduce((s: number, f: any) => s + (f.fee_amount_cents ?? 0), 0)
  const platformCostCents = subscription
    ? (subscription.price_monthly_cents ?? 0) + (subscription.seats_used ?? 0) * (subscription.price_per_seat_cents ?? 0)
    : 0

  // ── AI health score per association (0-100, from live operations data) ──
  type Health = { open: number; overdue: number; emergency: number; violations: number; score: number; status: 'healthy' | 'warning' | 'critical' }
  const assocHealth = new Map<string, Health>()
  const distribution = { healthy: 0, warning: 0, critical: 0 }
  for (const a of assocs ?? []) {
    const wo = woByAssoc.get(a.id) ?? { open: 0, overdue: 0, emergency: 0 }
    const viols = violByAssoc.get(a.id) ?? 0
    const score = Math.max(5, Math.min(100,
      100 - wo.overdue * 12 - wo.open * 4 - viols * 6 - wo.emergency * 15))
    const status: Health['status'] = score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical'
    distribution[status]++
    assocHealth.set(a.id, { ...wo, violations: viols, score, status })
  }
  const totalWithHealth = distribution.healthy + distribution.warning + distribution.critical
  const avgHealthScore = totalWithHealth > 0
    ? Math.round([...assocHealth.values()].reduce((s, h) => s + h.score, 0) / totalWithHealth)
    : 0

  // ── Delinquent accounts ────────────────────────────
  const { count: delinquentCount } = await db
    .from('occupancies')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'current')
    .lt('dues_paid_through', monthStart)

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────── */}
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Executive Dashboard</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Command center for {me.portfolio?.company_name ?? me.portfolio?.name ?? 'your portfolio'}
        </p>
      </div>

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
        <StatCard label="Delinquent Accounts" value={delinquentCount ?? 0} icon={TrendingUp} />
        <StatCard label="Avg Health Score" value={`${avgHealthScore}%`} icon={Heart} />
      </div>

      {/* ── Quick Actions ─────────────────────────────── */}
      <div className={`${card} p-5`}>
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Quick Actions</div>
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
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Manager Workload</h2>
            <p className="mt-0.5 text-xs text-gray-500">Assigned properties and open work per manager</p>
          </div>
          <Link href="/company-admin/performance" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline">
            Performance rankings <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Manager</th>
                <th className="px-5 py-2.5 text-right font-medium">Properties</th>
                <th className="px-5 py-2.5 text-right font-medium">Doors</th>
                <th className="px-5 py-2.5 text-right font-medium">Open WO</th>
                <th className="px-5 py-2.5 text-right font-medium">Overdue</th>
                <th className="px-5 py-2.5 text-right font-medium">Violations</th>
                <th className="px-5 py-2.5 text-right font-medium">ARC</th>
              </tr>
            </thead>
            <tbody>
              {(workload ?? []).length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">No managers with assigned properties yet. Managers with full-portfolio access appear once they are scoped to specific associations.</td></tr>
              ) : (
                (workload ?? []).map((w: any) => (
                  <tr key={w.manager_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/company-admin/managers/${w.manager_id}`} className="font-medium text-gray-900 hover:underline">{w.manager_name ?? w.manager_email}</Link>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{w.assigned_associations}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{Number(w.total_doors_managed ?? 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{w.open_work_orders}</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${w.overdue_work_orders > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>{w.overdue_work_orders}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{w.open_violations}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{w.open_arch_reviews}</td>
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
          <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Health Score Distribution</div>
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
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Property Health Scores</h2>
            <p className="mt-0.5 text-xs text-gray-500">Live health score per association — computed from open work, overdue items, emergencies, and violations</p>
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
                <th className="px-5 py-2.5 text-right font-medium">Units</th>
                <th className="px-5 py-2.5 text-right font-medium">Open WO</th>
                <th className="px-5 py-2.5 text-right font-medium">Overdue</th>
                <th className="px-5 py-2.5 text-right font-medium">Violations</th>
                <th className="px-5 py-2.5 text-right font-medium">Health Score</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(assocs ?? []).length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">No associations found.</td></tr>
              ) : (
                (assocs ?? []).map((assoc: any) => {
                  const h = assocHealth.get(assoc.id)
                  const tone = h?.status === 'critical' ? 'danger' : h?.status === 'warning' ? 'warning' : 'success'
                  const label = h?.status === 'critical' ? 'Critical' : h?.status === 'warning' ? 'Warning' : 'Healthy'
                  return (
                    <tr key={assoc.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-5 py-3">
                        <Link href={`/associations/${assoc.slug ?? assoc.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{assoc.name}</Link>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-700">{assoc.unit_count ?? '—'}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-700">{h?.open ?? 0}</td>
                      <td className={`px-5 py-3 text-right tabular-nums ${(h?.overdue ?? 0) > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>{h?.overdue ?? 0}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-700">{h?.violations ?? 0}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-semibold tabular-nums ${(h?.score ?? 100) >= 80 ? 'text-emerald-700' : (h?.score ?? 100) >= 50 ? 'text-amber-700' : 'text-red-700'}`}>{h?.score ?? 100}</span>
                      </td>
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
