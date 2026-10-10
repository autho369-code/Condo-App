import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePlatformOperator } from '@/lib/auth/me'
import {
  DollarSign,
  Building2,
  Users,
  DoorOpen,
  TrendingUp,
  Activity,
  MessageCircle,
  AlertTriangle,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ShieldAlert,
} from 'lucide-react'
import { displayTimeZone } from '@/lib/time/display-zone'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { Alert } from '@/components/ui/shell'
import {
  monthWindowInZone,
  monthlyRecurringCents,
  pastDueInvoicesFilter,
} from '@/lib/platform/operator-metrics'

export const dynamic = 'force-dynamic'

/* ── Helpers ──────────────────────────────────────────── */

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function percChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

/* ── Stat Card ────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  accent = 'navy',
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: React.ElementType
  trend?: { value: number; label: string }
  accent?: 'navy' | 'emerald' | 'amber' | 'red' | 'blue' | 'violet'
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
          {trend && (
            <div
              className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                trend.value >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
              }`}
            >
              {trend.value >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(trend.value)}% {trend.label}
            </div>
          )}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
      </div>
    </div>
  )
}

/* ── Bar Chart (CSS) ──────────────────────────────────── */

function BarChart({
  data,
  height = 160,
  valueLabel = '',
  barColor = '#2563EB',
}: {
  data: { label: string; value: number }[]
  height?: number
  valueLabel?: string
  barColor?: string
}) {
  if (data.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-400">No data available</div>
  }

  const max = Math.max(...data.map((d) => d.value), 1)
  const barWidth = Math.max(8, Math.floor(80 / data.length))

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(4, (d.value / max) * height)
        return (
          <div key={i} className="group relative flex flex-1 flex-col items-center justify-end">
            <div className="mb-1 text-[12px] font-medium text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">
              {valueLabel}{formatNumber(d.value)}
            </div>
            <div
              className="w-full rounded-t transition-colors hover:opacity-80"
              style={{ height: h, backgroundColor: barColor, minWidth: barWidth }}
            />
            <div className="mt-1.5 text-[12px] text-gray-400 truncate w-full text-center">
              {d.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Horizontal Bar ───────────────────────────────────── */

function HorizontalBar({
  data,
  valueFormatter = (v: number) => formatCurrency(v),
}: {
  data: { label: string; value: number; href?: string }[]
  valueFormatter?: (v: number) => string
}) {
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-32 flex-shrink-0 text-xs text-gray-600 truncate">
            {d.href ? (
              <Link href={d.href} className="hover:text-gray-950 hover:underline">
                {d.label}
              </Link>
            ) : (
              d.label
            )}
          </div>
          <div className="flex-1">
            <div className="h-5 w-full rounded bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{
                  width: `${(d.value / max) * 100}%`,
                  backgroundColor: '#2563EB',
                  opacity: 0.7 + (d.value / max) * 0.3,
                }}
              />
            </div>
          </div>
          <div className="w-20 flex-shrink-0 text-right text-xs font-medium tabular-nums text-gray-700">
            {valueFormatter(d.value)}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Status Badge ─────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    trialing: 'bg-blue-50 text-blue-700 border-blue-200',
    past_due: 'bg-red-50 text-red-700 border-red-200',
    canceled: 'bg-gray-100 text-gray-600 border-gray-200',
    paused: 'bg-amber-50 text-amber-700 border-amber-200',
    expired: 'bg-red-50 text-red-700 border-red-200',
    overdue: 'bg-red-50 text-red-700 border-red-200',
    open: 'bg-blue-50 text-blue-700 border-blue-200',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
    resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed: 'bg-gray-100 text-gray-600 border-gray-200',
  }

  const s = styles[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${s}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

/* ── Page ─────────────────────────────────────────────── */

export default async function PlatformOperatorOverviewPage() {
  const me = await requirePlatformOperator()
  const supabase = await createClient()
  const db = supabase as any

  const today = new Date()
  const zone = displayTimeZone()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000).toISOString()
  const sevenDaysFromNow = new Date(today.getTime() + 7 * 86400000).toISOString()

  // Last six calendar months in the platform zone (the server runs in UTC).
  const revenueMonths = [5, 4, 3, 2, 1, 0].map((i) => monthWindowInZone(zone, today, -i))
  const sixMonthsStartIso = revenueMonths[0].startIso
  const currentMonth = revenueMonths[revenueMonths.length - 1]
  const monthLabel = (month: string) => {
    const [y, m] = month.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  }
  const monthOf = (iso: string) => revenueMonths.find((w) => iso >= w.startIso && iso < w.endIso)?.month ?? null

  // ── Execute all queries ───────────────────────────────
  // Portier revenue comes from subscriptions (MRR) and paid platform invoices
  // (collected) — never management_fees, which is clients' own fee income
  // and not readable by operators anyway.
  const [
    subsRes,
    totalCompaniesRes,
    totalAssociationsRes,
    doorsRes,
    activeUsersRes,
    pastDueRes,
    openRequestsRes,
    companyHealthRes,
    paidInvoicesRes,
    portfolioCreationRes,
    portfolioNamesRes,
    activityRes,
    atRiskRes,
    doorGrowthRes,
  ] = await Promise.all([
    fetchAllRows<any>(() => db.from('subscriptions').select('id, portfolio_id, status, price_monthly_cents, seats_used, price_per_seat_cents, trial_ends_at').order('id')),
    db.from('portfolios').select('id', { count: 'exact', head: true }),
    db.from('associations').select('id', { count: 'exact', head: true }).is('archived_at', null),
    // Total doors must cover every association, past PostgREST's 1,000-row cap.
    fetchAllRows<any>(() => db.from('associations').select('id, unit_count').is('archived_at', null).order('id')),
    db.from('profiles').select('id', { count: 'exact', head: true }).gte('last_login_at', thirtyDaysAgo),
    pastDueInvoicesFilter(db.from('invoices').select('id', { count: 'exact', head: true })),
    db.from('platform_requests').select('id', { count: 'exact', head: true }).not('status', 'in', '("closed","resolved")'),
    db.from('v_company_health').select('*'),
    fetchAllRows<any>(() => db.from('invoices').select('id, portfolio_id, total_cents, paid_at').eq('status', 'paid').gte('paid_at', sixMonthsStartIso).order('id')),
    db.from('portfolios').select('created_at').gte('created_at', sixMonthsStartIso).order('created_at'),
    db.from('portfolios').select('id, company_name'),
    // Platform-wide trail: audit_logs (operators can read every row), not the
    // per-user `activity` table, which only ever showed the viewer's own rows.
    db.from('audit_logs').select('id, action, entity_type, actor_email, created_at').order('created_at', { ascending: false }).limit(20),
    db.from('subscriptions')
      .select('portfolio_id, status, trial_ends_at, portfolios!inner(company_name, id)')
      .or(`status.in.(past_due,paused,expired),and(status.eq.trialing,trial_ends_at.lte.${sevenDaysFromNow})`)
      .order('trial_ends_at', { ascending: true }),
    db.from('associations').select('created_at').is('archived_at', null).gte('created_at', sixMonthsStartIso).order('created_at'),
  ])

  const loadErrors = [
    subsRes.error && `Subscriptions: ${subsRes.error}`,
    totalCompaniesRes.error?.message && `Companies: ${totalCompaniesRes.error.message}`,
    totalAssociationsRes.error?.message && `Associations: ${totalAssociationsRes.error.message}`,
    doorsRes.error && `Doors: ${doorsRes.error}`,
    activeUsersRes.error?.message && `Active users: ${activeUsersRes.error.message}`,
    pastDueRes.error?.message && `Past-due invoices: ${pastDueRes.error.message}`,
    openRequestsRes.error?.message && `Support requests: ${openRequestsRes.error.message}`,
    companyHealthRes.error?.message && `Company health: ${companyHealthRes.error.message}`,
    paidInvoicesRes.error && `Paid invoices: ${paidInvoicesRes.error}`,
    portfolioCreationRes.error?.message && `Company growth: ${portfolioCreationRes.error.message}`,
    portfolioNamesRes.error?.message && `Company names: ${portfolioNamesRes.error.message}`,
    activityRes.error?.message && `Recent activity: ${activityRes.error.message}`,
    atRiskRes.error?.message && `Companies at risk: ${atRiskRes.error.message}`,
    doorGrowthRes.error?.message && `Association growth: ${doorGrowthRes.error.message}`,
  ].filter(Boolean) as string[]

  const totalCompanies = totalCompaniesRes.count
  const totalAssociations = totalAssociationsRes.count
  const activeUsers = activeUsersRes.count
  const overdueCount = pastDueRes.count
  const openRequestsCount = openRequestsRes.count
  const activityData = (activityRes.data ?? []) as any[]
  const atRiskData = (atRiskRes.data ?? []) as any[]

  // ── Compute stats ─────────────────────────────────────
  const subs = subsRes.rows
  const mrr = monthlyRecurringCents(subs)
  const activeSubs = subs.filter((s: any) => s.status === 'active').length
  const trialSubs = subs.filter((s: any) => s.status === 'trialing').length
  const pausedSubs = subs.filter((s: any) => s.status === 'paused').length
  const pastDueSubs = subs.filter((s: any) => s.status === 'past_due').length

  const totalDoors = doorsRes.rows.reduce(
    (sum: number, a: any) => sum + (a.unit_count ?? 0),
    0,
  )

  const health = (companyHealthRes.data ?? []) as any[]
  const criticalAlerts = health.reduce((sum: number, h: any) => sum + (h.critical_count ?? 0), 0)
  const totalWarningAlerts = health.reduce(
    (sum: number, h: any) => sum + (h.warning_count ?? 0),
    0,
  )

  // Collected platform revenue by month (paid invoices, by paid date).
  const revenueByMonth: Record<string, number> = {}
  for (const rm of revenueMonths) revenueByMonth[rm.month] = 0
  for (const inv of paidInvoicesRes.rows) {
    const key = inv.paid_at ? monthOf(new Date(inv.paid_at).toISOString()) : null
    if (key) revenueByMonth[key] += Number(inv.total_cents ?? 0)
  }
  const revenueChartData = revenueMonths.map((rm) => ({
    label: monthLabel(rm.month),
    value: Math.round(revenueByMonth[rm.month] / 100),
  }))
  const collectedThisMonth = revenueByMonth[currentMonth.month] ?? 0

  // Company growth by month
  const companiesByMonth: Record<string, number> = {}
  for (const rm of revenueMonths) companiesByMonth[rm.month] = 0
  for (const p of portfolioCreationRes.data ?? []) {
    const key = monthOf(new Date(p.created_at).toISOString())
    if (key) companiesByMonth[key]++
  }
  const companyGrowthChart = revenueMonths.map((rm) => ({
    label: monthLabel(rm.month),
    value: companiesByMonth[rm.month],
  }))

  // Association growth by month
  const doorsByMonth: Record<string, number> = {}
  for (const rm of revenueMonths) doorsByMonth[rm.month] = 0
  for (const a of doorGrowthRes.data ?? []) {
    const key = monthOf(new Date(a.created_at).toISOString())
    if (key) doorsByMonth[key]++
  }
  const doorGrowthChart = revenueMonths.map((rm) => ({
    label: monthLabel(rm.month),
    value: doorsByMonth[rm.month],
  }))

  // Top companies by monthly recurring revenue (billable subscriptions).
  const nameById = new Map<string, string>(((portfolioNamesRes.data ?? []) as any[]).map((p) => [p.id, p.company_name]))
  const topCompanies = subs
    .map((s: any) => ({ s, cents: monthlyRecurringCents([s]) }))
    .filter((r) => r.cents > 0)
    .sort((x, y) => y.cents - x.cents)
    .slice(0, 10)
    .map(({ s, cents }) => ({
      label: nameById.get(s.portfolio_id) ?? 'Unknown',
      href: `/platform-operator/companies/${s.portfolio_id}`,
      value: cents,
    }))

  return (
    <div className="space-y-7">
      {loadErrors.length > 0 && (
        <Alert title="Some platform figures could not be loaded — affected panels may read low.">
          {loadErrors.join(' · ')}
        </Alert>
      )}
      {/* ── Page Header ────────────────────────────────── */}
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Platform Command Center</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Executive overview across all management companies — revenue, doors, health, and risk.
        </p>
      </div>

      {/* ── Top Cards: Row 1 ───────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly Recurring Revenue"
          value={formatCurrency(mrr)}
          icon={DollarSign}
          sub="Active and past-due subscriptions"
          accent="navy"
        />
        <StatCard
          label="Total Companies"
          value={formatNumber(totalCompanies ?? 0)}
          sub={`${activeSubs} active · ${trialSubs} trial · ${pausedSubs + pastDueSubs} at risk`}
          icon={Building2}
          accent="blue"
        />
        <StatCard
          label="Total Associations"
          value={formatNumber(totalAssociations ?? 0)}
          sub={`${formatNumber(totalDoors)} doors across all properties`}
          icon={DoorOpen}
          accent="emerald"
        />
        <StatCard
          label="Active Users (30d)"
          value={formatNumber(activeUsers ?? 0)}
          sub="Logged in within last 30 days"
          icon={Users}
          accent="violet"
        />
      </div>

      {/* ── Top Cards: Row 2 ───────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Past-Due Invoices"
          value={formatNumber(overdueCount ?? 0)}
          sub="Open past their billing period"
          icon={CreditCard}
          accent={(overdueCount ?? 0) > 0 ? 'amber' : 'emerald'}
        />
        <StatCard
          label="Open Support Requests"
          value={formatNumber(openRequestsCount ?? 0)}
          sub="Awaiting response"
          icon={MessageCircle}
          accent={(openRequestsCount ?? 0) > 5 ? 'amber' : 'navy'}
        />
        <StatCard
          label="Critical Alerts"
          value={formatNumber(criticalAlerts)}
          sub={`${totalWarningAlerts} warning associations`}
          icon={AlertTriangle}
          accent={criticalAlerts > 0 ? 'red' : 'emerald'}
        />
        <StatCard
          label="Collected This Month"
          value={formatCurrency(collectedThisMonth)}
          sub="Paid platform invoices"
          icon={TrendingUp}
          accent="emerald"
        />
      </div>

      {/* ── Charts Row 1 ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Growth */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700">Revenue Growth — Last 6 Months</h3>
          <p className="mt-0.5 text-xs text-gray-500">Paid platform invoices collected by month</p>
          <div className="mt-4">
            <BarChart
              data={revenueChartData}
              height={160}
              valueLabel="$"
              barColor="#2563EB"
            />
          </div>
        </div>

        {/* Company Growth */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700">Company Growth — Last 6 Months</h3>
          <p className="mt-0.5 text-xs text-gray-500">New portfolios created</p>
          <div className="mt-4">
            <BarChart
              data={companyGrowthChart}
              height={160}
              valueLabel=""
              barColor="#2563EB"
            />
          </div>
        </div>
      </div>

      {/* ── Charts Row 2 ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Door Growth */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700">Association Growth — Last 6 Months</h3>
          <p className="mt-0.5 text-xs text-gray-500">New associations onboarded</p>
          <div className="mt-4">
            <BarChart
              data={doorGrowthChart}
              height={160}
              valueLabel=""
              barColor="#10B981"
            />
          </div>
        </div>

        {/* Trial Conversion Rate */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700">Subscription Distribution</h3>
          <p className="mt-0.5 text-xs text-gray-500">Active · Trial · Paused · Past Due</p>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Active</span>
                <span className="font-medium">{activeSubs}</span>
              </div>
              <div className="h-4 w-full rounded bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded bg-emerald-500"
                  style={{ width: `${subs.length > 0 ? (activeSubs / subs.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Trialing</span>
                <span className="font-medium">{trialSubs}</span>
              </div>
              <div className="h-4 w-full rounded bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded bg-blue-500"
                  style={{ width: `${subs.length > 0 ? (trialSubs / subs.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Paused</span>
                <span className="font-medium">{pausedSubs}</span>
              </div>
              <div className="h-4 w-full rounded bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded bg-amber-500"
                  style={{ width: `${subs.length > 0 ? (pausedSubs / subs.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Past Due</span>
                <span className="font-medium">{pastDueSubs}</span>
              </div>
              <div className="h-4 w-full rounded bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded bg-red-500"
                  style={{ width: `${subs.length > 0 ? (pastDueSubs / subs.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Revenue by Company ──────────────────────────── */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-700">
          Revenue by Company — Top 10
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Monthly recurring revenue by subscription
        </p>
        <div className="mt-4">
          {topCompanies.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No billable subscriptions yet.
            </div>
          ) : (
            <HorizontalBar data={topCompanies} />
          )}
        </div>
      </div>

      {/* ── Recent Activity + Companies at Risk ─────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Recent Activity */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Recent Activity</h3>
              <p className="mt-0.5 text-xs text-gray-500">Last 20 platform events</p>
            </div>
            <Link
              href="/platform-operator/audit-logs"
              className="text-xs font-medium text-gray-700 hover:text-gray-950 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-xs uppercase text-gray-500">
                  <th className="px-5 py-3 text-left font-medium">Action</th>
                  <th className="px-5 py-3 text-left font-medium">Details</th>
                  <th className="px-5 py-3 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activityData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                      No recent activity.
                    </td>
                  </tr>
                ) : (
                  activityData.map((a: any) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <span className="font-medium text-gray-800">{String(a.action ?? '—').replace(/_/g, ' ')}</span>
                        {a.actor_email && (
                          <span className="ml-2 text-xs text-gray-400">by {a.actor_email}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500 max-w-xs truncate">
                        {a.entity_type ? String(a.entity_type).replace(/_/g, ' ') : '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-gray-400 tabular-nums">
                        {a.created_at
                          ? new Date(a.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: displayTimeZone(),
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Companies at Risk */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Companies at Risk</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                Suspended, past due, or trials expiring within 7 days
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-xs uppercase text-gray-500">
                  <th className="px-5 py-3 text-left font-medium">Company</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Trial Ends</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {atRiskData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                      <ShieldAlert className="mx-auto h-5 w-5 mb-1 text-emerald-500" />
                      No companies at risk. All systems healthy.
                    </td>
                  </tr>
                ) : (
                  atRiskData.slice(0, 15).map((row: any) => {
                    const portfolios = Array.isArray(row.portfolios)
                      ? row.portfolios
                      : [row.portfolios]
                    const company = portfolios?.[0]
                    return (
                      <tr key={row.portfolio_id} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <Link
                            href={`/platform-operator/companies/${row.portfolio_id}`}
                            className="font-medium text-gray-700 hover:text-gray-950 hover:underline"
                          >
                            {company?.company_name ?? 'Unknown'}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-gray-500 tabular-nums">
                          {row.trial_ends_at
                            ? new Date(row.trial_ends_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                timeZone: displayTimeZone(),
                              })
                            : '—'}
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

      {/* ── Health Summary ──────────────────────────────── */}
      {health.length > 0 && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Association Health by Company</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                Healthy · Warning · Critical breakdown per portfolio
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-xs uppercase text-gray-500">
                  <th className="px-5 py-3 text-left font-medium">Portfolio</th>
                  <th className="px-5 py-3 text-right font-medium">Total Assocs</th>
                  <th className="px-5 py-3 text-right font-medium">Doors</th>
                  <th className="px-5 py-3 text-right font-medium">Healthy</th>
                  <th className="px-5 py-3 text-right font-medium">Warning</th>
                  <th className="px-5 py-3 text-right font-medium">Critical</th>
                  <th className="px-5 py-3 text-right font-medium">Delinquency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {health.slice(0, 20).map((h: any) => (
                  <tr key={h.portfolio_id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/platform-operator/companies/${h.portfolio_id}`}
                        className="font-medium text-gray-700 hover:text-gray-950 hover:underline"
                      >
                        {h.portfolio_id}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">
                      {h.total_associations ?? 0}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">
                      {h.total_doors ?? 0}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className="text-emerald-600 font-medium">{h.healthy_count ?? 0}</span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span
                        className={
                          (h.warning_count ?? 0) > 0
                            ? 'text-amber-600 font-medium'
                            : 'text-gray-500'
                        }
                      >
                        {h.warning_count ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span
                        className={
                          (h.critical_count ?? 0) > 0
                            ? 'text-red-600 font-medium'
                            : 'text-gray-500'
                        }
                      >
                        {h.critical_count ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-500">
                      {h.delinquency_total_cents
                        ? formatCurrency(h.delinquency_total_cents)
                        : '$0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
