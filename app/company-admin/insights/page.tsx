import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { receivableAgingBuckets } from '@/lib/finance/totals'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { date, money } from '@/lib/utils'
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  FileWarning,
  UserX,
  Building2,
  CheckCircle2,
} from 'lucide-react'
import { addDaysToDate, todayInZone } from '@/lib/time/zoned'
import { Alert } from '@/components/ui/shell'
import { collectLoadErrors } from '@/lib/company-admin/load-errors'
import { vendorAssociationLabel } from '@/lib/vendors/options'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
const OPEN_WO_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress']

type Insight = {
  severity: 'critical' | 'warning' | 'info'
  icon: React.ElementType
  title: string
  detail: string
  href: string
}

export default async function AICommandCenterPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const now = Date.now()
  // Calendar dates are the company's zone (server code runs in UTC).
  const today = todayInZone()
  const in60 = addDaysToDate(today, 60)
  const d30 = new Date(now - 30 * 86400000).toISOString()
  const d60 = new Date(now - 60 * 86400000).toISOString()

  const [
    { data: assocs, error: assocsError },
    { data: openWOs, error: openWOsError },
    { data: viols, error: violsError },
    { data: vendors, error: vendorsError },
    agingBuckets,
    { data: recentBills, error: billsError },
    { data: policies, error: policiesError },
    { data: workload, error: workloadError },
  ] = await Promise.all([
    db.from('associations').select('id, name, slug').eq('portfolio_id', portfolioId).is('archived_at', null),
    fetchAllRows(() => db.from('work_orders').select('id, association_id, scheduled_date, priority').eq('portfolio_id', portfolioId).is('archived_at', null).in('status', OPEN_WO_STATUSES).order('id')).then((r) => ({ data: r.rows, error: r.error })),
    // Only the last 60 days feed the trend; paged past 1,000 rows.
    fetchAllRows(() => db.from('violations').select('id, association_id, created_at, status, archived_at').gte('created_at', d60).order('id')).then((r) => ({ data: r.rows, error: r.error })),
    // Paged: with one record per association a company can pass 1,000 vendors.
    fetchAllRows(() => db.from('vendors').select('id, name, contract_expiration, general_liability_expiration, state_license_expiration, is_management_company, associations(name)').eq('portfolio_id', portfolioId).is('archived_at', null).order('name').order('id')).then((r) => ({ data: r.rows, error: r.error })),
    receivableAgingBuckets(db),
    fetchAllRows(() => db.from('payable_bills').select('id, amount, created_at').eq('portfolio_id', portfolioId).is('archived_at', null).gte('created_at', d60).order('id')).then((r) => ({ data: r.rows, error: r.error })),
    db.from('insurance_policies').select('id, expiration_date, owners(full_name)').is('archived_at', null).in('status', ['active', 'expiring_soon']).lte('expiration_date', in60).gte('expiration_date', today),
    db.from('v_manager_workload').select('*'),
  ])

  const loadErrors = collectLoadErrors({
    Associations: { error: assocsError },
    'Work orders': { error: openWOsError },
    Violations: { error: violsError },
    Vendors: { error: vendorsError },
    Bills: { error: billsError },
    'Insurance policies': { error: policiesError },
    'Manager workload': { error: workloadError },
  })

  const assocIds = new Set((assocs ?? []).map((a: any) => a.id))
  const nameById = new Map<string, string>((assocs ?? []).map((a: any) => [a.id, a.name]))
  const insights: Insight[] = []

  // ── Associations needing attention ───────────────────────────
  const woByAssoc = new Map<string, { open: number; overdue: number; emergency: number }>()
  for (const wo of openWOs ?? []) {
    const e = woByAssoc.get(wo.association_id) ?? { open: 0, overdue: 0, emergency: 0 }
    e.open++
    if (wo.scheduled_date && wo.scheduled_date < today) e.overdue++
    if (wo.priority === 'emergency') e.emergency++
    woByAssoc.set(wo.association_id, e)
  }
  for (const [assocId, wo] of woByAssoc) {
    if (!assocIds.has(assocId)) continue
    if (wo.emergency > 0) {
      insights.push({
        severity: 'critical', icon: AlertTriangle,
        title: `${nameById.get(assocId)}: ${wo.emergency} open emergency work order${wo.emergency === 1 ? '' : 's'}`,
        detail: 'Emergency-priority work is open right now. Confirm a vendor is dispatched and the board is informed.',
        href: '/company-admin/work-orders',
      })
    } else if (wo.overdue > 2) {
      insights.push({
        severity: 'warning', icon: Building2,
        title: `${nameById.get(assocId)} needs attention — ${wo.overdue} overdue work orders`,
        detail: `${wo.open} open work orders total. Overdue items drag response times and board confidence.`,
        href: '/company-admin/work-orders',
      })
    }
  }

  // ── Managers falling behind ──────────────────────────────────
  for (const w of workload ?? []) {
    if ((w.overdue_work_orders ?? 0) > 0) {
      insights.push({
        severity: (w.overdue_work_orders ?? 0) > 3 ? 'critical' : 'warning', icon: UserX,
        title: `${w.manager_name ?? w.manager_email} is falling behind — ${w.overdue_work_orders} overdue`,
        detail: `${w.open_work_orders} open work orders across ${w.assigned_associations} propert${w.assigned_associations === 1 ? 'y' : 'ies'}. Consider rebalancing assignments.`,
        href: '/company-admin/performance',
      })
    }
  }

  // ── Contracts / credentials expiring ─────────────────────────
  for (const v of vendors ?? []) {
    if (v.contract_expiration && v.contract_expiration >= today && v.contract_expiration <= in60) {
      insights.push({
        severity: 'warning', icon: FileWarning,
        title: `Contract with ${v.name} (${vendorAssociationLabel(v)}) expires ${date(v.contract_expiration)}`,
        detail: 'Renegotiate or rebid before expiration to avoid service gaps.',
        href: '/company-admin/vendors',
      })
    }
    if (v.general_liability_expiration && v.general_liability_expiration < today) {
      insights.push({
        severity: 'critical', icon: ShieldAlert,
        title: `${v.name} (${vendorAssociationLabel(v)}) has an EXPIRED certificate of insurance`,
        detail: 'Do not dispatch this vendor until a current COI is on file — liability exposure.',
        href: '/company-admin/compliance',
      })
    }
    if (v.state_license_expiration && v.state_license_expiration < today) {
      insights.push({
        severity: 'critical', icon: ShieldAlert,
        title: `${v.name} (${vendorAssociationLabel(v)})'s state license has expired`,
        detail: 'Verify license renewal before assigning new work.',
        href: '/company-admin/compliance',
      })
    }
  }

  // ── Violation trend ──────────────────────────────────────────
  const violInScope = (viols ?? []).filter((v: any) => assocIds.has(v.association_id))
  const viols30 = violInScope.filter((v: any) => v.created_at >= d30).length
  const violsPrior = violInScope.filter((v: any) => v.created_at >= d60 && v.created_at < d30).length
  if (viols30 > violsPrior && viols30 > 0) {
    insights.push({
      severity: 'warning', icon: TrendingUp,
      title: `Violations are increasing: ${viols30} filed in the last 30 days (was ${violsPrior})`,
      detail: 'Rising violations often signal a maintenance or communication problem — review by association.',
      href: '/company-admin/violations',
    })
  }

  // ── Maintenance cost trend ───────────────────────────────────
  const bills30 = (recentBills ?? []).filter((b: any) => b.created_at >= d30).reduce((s: number, b: any) => s + Number(b.amount ?? 0), 0)
  const billsPrior = (recentBills ?? []).filter((b: any) => b.created_at < d30).reduce((s: number, b: any) => s + Number(b.amount ?? 0), 0)
  if (billsPrior > 0 && bills30 > billsPrior * 1.25) {
    insights.push({
      severity: 'warning', icon: TrendingUp,
      title: `Vendor spend up ${Math.round(((bills30 - billsPrior) / billsPrior) * 100)}% month over month`,
      detail: `${money(bills30)} billed in the last 30 days vs ${money(billsPrior)} the prior 30. Check for one-offs vs a trend.`,
      href: '/company-admin/financials',
    })
  }

  // ── Delinquency ──────────────────────────────────────────────
  const arTotal = Object.values(agingBuckets).reduce((s, v) => s + v, 0)
  const seriouslyLate = (agingBuckets['61_90'] ?? 0) + (agingBuckets['90_plus'] ?? 0)
  if (seriouslyLate > 0) {
    insights.push({
      severity: seriouslyLate > arTotal * 0.4 ? 'critical' : 'warning', icon: TrendingDown,
      title: `${money(seriouslyLate)} in receivables is 61+ days past due`,
      detail: `Total A/R is ${money(arTotal)}. Consider demand letters or a collections policy review for the oldest balances.`,
      href: '/company-admin/financials',
    })
  }

  // ── Insurance renewals ───────────────────────────────────────
  for (const p of policies ?? []) {
    insights.push({
      severity: 'info', icon: FileWarning,
      title: `${p.owners?.full_name ?? 'An owner'}'s insurance renews ${date(p.expiration_date)}`,
      detail: 'Request an updated certificate before the policy lapses.',
      href: '/company-admin/compliance',
    })
  }

  const order = { critical: 0, warning: 1, info: 2 } as const
  insights.sort((a, b) => order[a.severity] - order[b.severity])
  const counts = {
    critical: insights.filter((i) => i.severity === 'critical').length,
    warning: insights.filter((i) => i.severity === 'warning').length,
    info: insights.filter((i) => i.severity === 'info').length,
  }

  const sevStyles = {
    critical: 'border-red-200 bg-red-50/60',
    warning: 'border-amber-200 bg-amber-50/60',
    info: 'border-gray-200/70 bg-white',
  } as const
  const sevIcon = {
    critical: 'text-red-600',
    warning: 'text-amber-600',
    info: 'text-gray-400',
  } as const

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-950">
          <Sparkles className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">AI Command Center</h1>
          <p className="mt-0.5 text-sm leading-6 text-gray-500">
            Live portfolio intelligence — {counts.critical} critical · {counts.warning} warnings · {counts.info} advisories
          </p>
        </div>
      </div>

      {loadErrors.length > 0 && (
        <Alert tone="danger" title="Some portfolio data could not be loaded; insights below are incomplete.">{loadErrors.join(' · ')}</Alert>
      )}

      {insights.length === 0 && loadErrors.length === 0 ? (
        <div className={`${card} px-5 py-14 text-center`}>
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          <div className="text-[14.5px] font-semibold text-ink">All clear</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            No portfolio risks detected right now. Insights appear here when emergencies open, managers fall behind,
            credentials expire, violations trend up, spend spikes, or receivables age.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((ins, i) => {
            const Icon = ins.icon
            return (
              <Link key={i} href={ins.href} className={`block rounded-2xl border p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-gray-50/80 ${sevStyles[ins.severity]}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-inset ring-gray-200/70 ${sevIcon[ins.severity]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-semibold text-ink">{ins.title}</div>
                    <p className="mt-0.5 text-[13px] leading-5 text-gray-600">{ins.detail}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <p className="text-xs leading-5 text-gray-400">
        Insights are computed live from your portfolio&apos;s work orders, violations, vendor credentials, receivables,
        bills, and insurance records — deterministic rules, no fabricated data. For conversational analysis, use the{' '}
        <Link href="/assistant" className="underline">Portfolio Assistant</Link> with your own AI key.
      </p>
    </div>
  )
}
