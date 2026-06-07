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
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    navy: { bg: 'rgba(30,58,95,0.08)', text: '#1E3A5F', border: 'rgba(30,58,95,0.15)' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200' },
  }

  const c = colorMap[accent]

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</div>
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
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg border"
          style={{
            backgroundColor: accent === 'navy' ? 'rgba(30,58,95,0.08)' : undefined,
            borderColor: accent === 'navy' ? 'rgba(30,58,95,0.15)' : undefined,
          }}
        >
          <Icon className="h-5 w-5" style={accent === 'navy' ? { color: '#1E3A5F' } : undefined} />
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
  barColor = '#1E3A5F',
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
            <div className="mb-1 text-[10px] font-medium text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">
              {valueLabel}{formatNumber(d.value)}
            </div>
            <div
              className="w-full rounded-t transition-colors hover:opacity-80"
              style={{ height: h, backgroundColor: barColor, minWidth: barWidth }}
            />
            <div className="mt-1.5 text-[10px] text-gray-400 truncate w-full text-center">
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
              <Link href={d.href} className="hover:text-[#1E3A5F] hover:underline">
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
                  backgroundColor: '#1E3A5F',
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
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000).toISOString()
  const sixMonthsAgo = new Date(today.getTime() - 180 * 86400000).toISOString()
  const sevenDaysFromNow = new Date(today.getTime() + 7 * 86400000).toISOString()

  // ── Build all queries ─────────────────────────────────
  const mrrQuery = db
    .from('subscriptions')
    .select('price_monthly_cents, status')
    .in('status', ['active', 'trialing'])

  const allSubscriptionsQuery = db.from('subscriptions').select('status, trial_ends_at')

  const totalCompaniesQuery = db
    .from('portfolios')
    .select('id', { count: 'exact', head: true })

  const totalAssociationsQuery = db
    .from('associations')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)

  const doorsQuery = db
    .from('associations')
    .select('unit_count')
    .is('archived_at', null)

  const activeUsersQuery = db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('last_login_at', thirtyDaysAgo)

  const overduePaymentsQuery = db
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'overdue')

  const openRequestsQuery = db
    .from('platform_requests')
    .select('id', { count: 'exact', head: true })
    .not('status', 'in', '("closed","resolved")')

  const companyHealthQuery = db.from('v_company_health').select('*')

  // Revenue growth: last 6 months from management_fees
  const revenueMonths: { month: string; date: Date }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    revenueMonths.push({
      month: d.toISOString().slice(0, 7),
      date: d,
    })
  }

  const revenueGrowthQuery = db
    .from('management_fees')
    .select('month, fee_amount_cents')
    .gte('month', revenueMonths[0].month + '-01')
    .lte('month', revenueMonths[revenueMonths.length - 1].month + '-31')

  // Company growth: portfolios created by month (last 6 months)
  const portfolioCreationQuery = db
    .from('portfolios')
    .select('created_at')
    .gte('created_at', revenueMonths[0].date.toISOString())
    .order('created_at')

  // Top companies by revenue (current month)
  const topRevenueQuery = db
    .from('management_fees')
    .select('portfolio_id, fee_amount_cents, portfolios!inner(company_name, id)')
    .eq('month', `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`)
    .order('fee_amount_cents', { ascending: false })
    .limit(10)

  // Recent activity
  const activityQuery = db
    .from('activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  // Companies at risk
  const atRiskQuery = db
    .from('subscriptions')
    .select('portfolio_id, status, trial_ends_at, portfolios!inner(company_name, id)')
    .or(`status.in.(past_due,paused,expired),and(status.eq.trialing,trial_ends_at.lte.${sevenDaysFromNow})`)
    .order('trial_ends_at', { ascending: true })

  // Trial conversion: count trials that became active vs total trials
  const trialConversionQuery = db
    .from('subscription_events')
    .select('event_type, subscription_id')
    .eq('event_type', 'trial_converted')

  // Door growth: associations with unit_count, created by month
  const doorGrowthQuery = db
    .from('associations')
    .select('created_at, unit_count')
    .is('archived_at', null)
    .gte('created_at', revenueMonths[0].date.toISOString())
    .order('created_at')

  // ── Execute all queries ───────────────────────────────
  const [
    { data: mrrData },
    { data: allSubsData },
    { count: totalCompanies },
    { count: totalAssociations },
    { data: doorsData },
    { count: activeUsers },
    { count: overdueCount },
    { count: openRequestsCount },
    { data: companyHealth },
    { data: revenueData },
    { data: portfolioCreationData },
    { data: topRevenueData },
    { data: activityData },
    { data: atRiskData },
    { data: trialConversionData },
    { data: doorGrowthData },
  ] = await Promise.all([
    mrrQuery,
    allSubscriptionsQuery,
    totalCompaniesQuery,
    totalAssociationsQuery,
    doorsQuery,
    activeUsersQuery,
    overduePaymentsQuery,
    openRequestsQuery,
    companyHealthQuery,
    revenueGrowthQuery,
    portfolioCreationQuery,
    topRevenueQuery,
    activityQuery,
    atRiskQuery,
    trialConversionQuery,
    doorGrowthQuery,
  ])

  // ── Compute stats ─────────────────────────────────────
  const mrr = (mrrData ?? []).reduce(
    (sum: number, s: any) => sum + (s.price_monthly_cents ?? 0),
    0,
  )

  const subs = allSubsData ?? []
  const activeSubs = subs.filter((s: any) => s.status === 'active').length
  const trialSubs = subs.filter((s: any) => s.status === 'trialing').length
  const pausedSubs = subs.filter((s: any) => s.status === 'paused').length
  const pastDueSubs = subs.filter((s: any) => s.status === 'past_due').length

  const totalDoors = (doorsData ?? []).reduce(
    (sum: number, a: any) => sum + (a.unit_count ?? 0),
    0,
  )

  const health = companyHealth ?? []
  const criticalAlerts = health.reduce((sum: number, h: any) => sum + (h.critical_count ?? 0), 0)
  const totalWarningAlerts = health.reduce(
    (sum: number, h: any) => sum + (h.warning_count ?? 0),
    0,
  )

  // Revenue by month aggregation
  const revenueByMonth: Record<string, number> = {}
  for (const rm of revenueMonths) {
    revenueByMonth[rm.month] = 0
  }
  for (const fee of revenueData ?? []) {
    const monthKey = (fee.month as string).slice(0, 7)
    if (revenueByMonth[monthKey] !== undefined) {
      revenueByMonth[monthKey] += fee.fee_amount_cents ?? 0
    }
  }

  const revenueChartData = Object.entries(revenueByMonth).map(([month, cents]) => ({
    label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
    value: Math.round(cents / 100),
  }))

  // Company growth by month
  const companiesByMonth: Record<string, number> = {}
  for (const rm of revenueMonths) {
    const key = rm.date.toISOString().slice(0, 7)
    companiesByMonth[key] = 0
  }
  for (const p of portfolioCreationData ?? []) {
    const key = (p.created_at as string).slice(0, 7)
    if (companiesByMonth[key] !== undefined) {
      companiesByMonth[key]++
    }
  }

  const companyGrowthChart = Object.entries(companiesByMonth).map(
    ([month, count]) => ({
      label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
      value: count,
    }),
  )

  // Door growth by month
  const doorsByMonth: Record<string, number> = {}
  for (const rm of revenueMonths) {
    const key = rm.date.toISOString().slice(0, 7)
    doorsByMonth[key] = 0
  }
  for (const a of doorGrowthData ?? []) {
    const key = (a.created_at as string).slice(0, 7)
    // Count associations created this month weighted by unit_count
    // Simple approach: just count associations
    if (doorsByMonth[key] !== undefined) {
      doorsByMonth[key]++
    }
  }

  const doorGrowthChart = Object.entries(doorsByMonth).map(([month, count]) => ({
    label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
    value: count,
  }))

  // Trial conversion rate
  const totalTrials = subs.filter((s: any) => s.status !== 'canceled').length
  const convertedTrials = (trialConversionData ?? []).length
  const conversionRate =
    totalTrials > 0 ? Math.round((activeSubs / totalTrials) * 100) : 0

  // Top companies by revenue
  const topCompanies = (topRevenueData ?? []).slice(0, 10).map((r: any) => {
    const portfolios = Array.isArray(r.portfolios) ? r.portfolios : [r.portfolios]
    const company = portfolios?.[0]
    return {
      label: company?.company_name ?? 'Unknown',
      href: `/platform/portfolios/${r.portfolio_id}`,
      value: r.fee_amount_cents ?? 0,
    }
  })

  return (
    <div className="space-y-7">
      {/* ── Page Header ────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Command Center</h1>
        <p className="mt-1 text-sm text-gray-500">
          Executive overview across all management companies — revenue, doors, health, and risk.
        </p>
      </div>

      {/* ── Top Cards: Row 1 ───────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly Recurring Revenue"
          value={formatCurrency(mrr)}
          icon={DollarSign}
          accent="navy"
          trend={
            revenueChartData.length >= 2
              ? {
                  value: percChange(
                    revenueChartData[revenueChartData.length - 1].value,
                    revenueChartData[revenueChartData.length - 2].value,
                  ),
                  label: 'vs last month',
                }
              : undefined
          }
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
          label="Overdue Invoices"
          value={formatNumber(overdueCount ?? 0)}
          sub="Pending payment"
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
          label="Trial Conversion"
          value={`${conversionRate}%`}
          sub={`${activeSubs} active of ${totalTrials} total subscriptions`}
          icon={TrendingUp}
          accent={conversionRate >= 60 ? 'emerald' : conversionRate >= 30 ? 'amber' : 'red'}
        />
      </div>

      {/* ── Charts Row 1 ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Growth */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700">Revenue Growth — Last 6 Months</h3>
          <p className="mt-0.5 text-xs text-gray-500">Management fee income by month</p>
          <div className="mt-4">
            <BarChart
              data={revenueChartData}
              height={160}
              valueLabel="$"
              barColor="#1E3A5F"
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
          Current month management fee income
        </p>
        <div className="mt-4">
          {topCompanies.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No revenue data for the current month.
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
              className="text-xs font-medium text-[#1E3A5F] hover:underline"
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
                {(activityData ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                      No recent activity.
                    </td>
                  </tr>
                ) : (
                  (activityData ?? []).map((a: any) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <span className="font-medium text-gray-800">{a.action ?? '—'}</span>
                        {a.agent && (
                          <span className="ml-2 text-xs text-gray-400">by {a.agent}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500 max-w-xs truncate">
                        {a.details ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-gray-400 tabular-nums">
                        {a.created_at
                          ? new Date(a.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
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
                {(atRiskData ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                      <ShieldAlert className="mx-auto h-5 w-5 mb-1 text-emerald-500" />
                      No companies at risk. All systems healthy.
                    </td>
                  </tr>
                ) : (
                  (atRiskData ?? []).slice(0, 15).map((row: any) => {
                    const portfolios = Array.isArray(row.portfolios)
                      ? row.portfolios
                      : [row.portfolios]
                    const company = portfolios?.[0]
                    return (
                      <tr key={row.portfolio_id} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <Link
                            href={`/platform/portfolios/${row.portfolio_id}`}
                            className="font-medium text-[#1E3A5F] hover:underline"
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
      {(health ?? []).length > 0 && (
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
                        href={`/platform/portfolios/${h.portfolio_id}`}
                        className="font-medium text-[#1E3A5F] hover:underline"
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
