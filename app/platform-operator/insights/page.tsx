import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePlatformOperator } from '@/lib/auth/me'
import { money } from '@/lib/utils'
import {
  Sparkles,
  Building2,
  CalendarClock,
  DoorOpen,
  CreditCard,
  MailWarning,
  Webhook,
  UserX,
  CheckCircle2,
  Users,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

type Insight = {
  severity: 'critical' | 'warning' | 'info'
  icon: React.ElementType
  title: string
  detail: string
  href: string
}

export default async function PlatformInsightsPage() {
  await requirePlatformOperator()
  const supabase = await createClient()
  const db = supabase as any
  const now = new Date()
  const nowIso = now.toISOString()
  const todayDate = nowIso.slice(0, 10)
  const in7 = new Date(now.getTime() + 7 * 86400000).toISOString()
  const d14 = new Date(now.getTime() - 14 * 86400000).toISOString()
  const d7 = new Date(now.getTime() - 7 * 86400000).toISOString()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [
    { data: portfolios },
    { data: subs },
    { data: usage },
    { data: invoices },
    { data: failedEmails },
    { data: endpoints },
    { data: profiles },
    { count: ownersCount },
    { count: vendorsCount },
    { count: boardCount },
    { count: newOwnersMonth },
  ] = await Promise.all([
    db.from('portfolios').select('id, company_name, archived_at, suspended_at').is('archived_at', null),
    db.from('subscriptions').select('portfolio_id, tier, status, price_monthly_cents, seats_used, price_per_seat_cents, trial_ends_at, current_period_end, canceled_at'),
    db.from('billing_usage').select('portfolio_id, doors_active, doors_limit, status').eq('status', 'active'),
    db.from('invoices').select('portfolio_id, number, total_cents, status, period_end').not('status', 'in', '("paid","void")'),
    db.from('email_queue').select('id, to_email, subject, error_message, created_at').eq('status', 'failed').gte('created_at', d7).limit(20),
    db.from('webhook_endpoints').select('id, portfolio_id, name, active, failure_count, last_failure_at, last_failure_message'),
    db.from('profiles').select('portfolio_id, last_login_at, hoa_role'),
    db.from('owners').select('id', { count: 'exact', head: true }).is('archived_at', null),
    db.from('vendors').select('id', { count: 'exact', head: true }).is('archived_at', null),
    db.from('board_members').select('id', { count: 'exact', head: true }),
    db.from('owners').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
  ])

  const nameById = new Map<string, string>((portfolios ?? []).map((p: any) => [p.id, p.company_name ?? 'Company']))
  const insights: Insight[] = []

  // ── Executive metrics ────────────────────────────────────────
  const activeSubs = (subs ?? []).filter((s: any) => s.status === 'active')
  const mrrCents = activeSubs.reduce(
    (s: number, x: any) => s + (x.price_monthly_cents ?? 0) + (x.seats_used ?? 0) * (x.price_per_seat_cents ?? 0), 0)
  const canceled90 = (subs ?? []).filter((s: any) => s.canceled_at && s.canceled_at >= new Date(now.getTime() - 90 * 86400000).toISOString()).length
  const churnRate = (subs ?? []).length > 0 ? Math.round((canceled90 / (subs ?? []).length) * 100) : 0
  const staffCount = (profiles ?? []).filter((p: any) => ['manager', 'company_admin'].includes(p.hoa_role)).length
  const totalUsers = (profiles ?? []).length + (vendorsCount ?? 0)

  // ── Companies gone quiet (no staff login in 14 days) ─────────
  const lastLoginByPortfolio = new Map<string, string>()
  for (const p of profiles ?? []) {
    if (!p.portfolio_id || !p.last_login_at) continue
    const prev = lastLoginByPortfolio.get(p.portfolio_id)
    if (!prev || p.last_login_at > prev) lastLoginByPortfolio.set(p.portfolio_id, p.last_login_at)
  }
  for (const p of portfolios ?? []) {
    if (p.suspended_at) continue
    const last = lastLoginByPortfolio.get(p.id)
    if (!last || last < d14) {
      insights.push({
        severity: 'warning',
        icon: Building2,
        title: `${p.company_name ?? 'A company'} hasn't logged in for 14+ days`,
        detail: last ? `Last staff login ${last.slice(0, 10)}. Silent customers churn — reach out.` : 'No staff login on record.',
        href: `/platform-operator/companies/${p.id}`,
      })
    }
  }

  // ── Renewals + trials this week ──────────────────────────────
  const renewing = (subs ?? []).filter((s: any) => s.status === 'active' && s.current_period_end && s.current_period_end >= nowIso && s.current_period_end <= in7)
  if (renewing.length > 0) {
    insights.push({
      severity: 'info',
      icon: CalendarClock,
      title: `${renewing.length} subscription${renewing.length === 1 ? '' : 's'} renew${renewing.length === 1 ? 's' : ''} this week`,
      detail: renewing.map((s: any) => nameById.get(s.portfolio_id) ?? 'Company').join(' · '),
      href: '/platform-operator/billing',
    })
  }
  for (const s of (subs ?? []).filter((x: any) => x.trial_ends_at && x.trial_ends_at >= nowIso && x.trial_ends_at <= in7)) {
    insights.push({
      severity: 'warning',
      icon: CalendarClock,
      title: `${nameById.get(s.portfolio_id) ?? 'A company'}'s trial ends ${s.trial_ends_at.slice(0, 10)}`,
      detail: 'Follow up before the trial lapses to close the conversion.',
      href: `/platform-operator/companies/${s.portfolio_id}`,
    })
  }

  // ── Door limits ──────────────────────────────────────────────
  for (const u of (usage ?? []).filter((x: any) => (x.doors_limit ?? 0) > 0 && (x.doors_active ?? 0) > x.doors_limit)) {
    insights.push({
      severity: 'critical',
      icon: DoorOpen,
      title: `${nameById.get(u.portfolio_id) ?? 'A company'} exceeded its door limit (${u.doors_active}/${u.doors_limit})`,
      detail: 'Upsell opportunity — move them to the next tier or bill the overage.',
      href: '/platform-operator/door-usage',
    })
  }

  // ── Unpaid invoices past period end ──────────────────────────
  const overdueInvoices = (invoices ?? []).filter((i: any) => i.period_end && i.period_end < todayDate)
  if (overdueInvoices.length > 0) {
    const total = overdueInvoices.reduce((s: number, i: any) => s + (i.total_cents ?? 0), 0)
    insights.push({
      severity: 'critical',
      icon: CreditCard,
      title: `${overdueInvoices.length} unpaid invoice${overdueInvoices.length === 1 ? '' : 's'} past due — ${money(total / 100)}`,
      detail: overdueInvoices.slice(0, 3).map((i: any) => `${nameById.get(i.portfolio_id) ?? 'Company'} (#${i.number ?? '—'})`).join(' · '),
      href: '/platform-operator/billing',
    })
  }

  // ── Suspended companies ──────────────────────────────────────
  for (const p of (portfolios ?? []).filter((x: any) => x.suspended_at)) {
    insights.push({
      severity: 'info',
      icon: UserX,
      title: `${p.company_name ?? 'A company'} is suspended`,
      detail: `Suspended ${String(p.suspended_at).slice(0, 10)}. Reactivate or archive.`,
      href: `/platform-operator/companies/${p.id}`,
    })
  }

  // ── Delivery infrastructure ──────────────────────────────────
  if ((failedEmails ?? []).length > 0) {
    insights.push({
      severity: 'warning',
      icon: MailWarning,
      title: `${(failedEmails ?? []).length} email${(failedEmails ?? []).length === 1 ? '' : 's'} failed to send in the last 7 days`,
      detail: (failedEmails ?? []).slice(0, 2).map((e: any) => `${e.to_email}: ${e.error_message ?? 'unknown error'}`).join(' · '),
      href: '/platform-operator/system',
    })
  }
  for (const w of (endpoints ?? []).filter((x: any) => x.active && (x.failure_count ?? 0) > 0)) {
    insights.push({
      severity: 'warning',
      icon: Webhook,
      title: `Webhook "${w.name}" (${nameById.get(w.portfolio_id) ?? 'Company'}) is failing`,
      detail: `${w.failure_count} failure${w.failure_count === 1 ? '' : 's'}${w.last_failure_message ? ` — ${w.last_failure_message}` : ''}`,
      href: '/platform-operator/system',
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
  const sevIcon = { critical: 'text-red-600', warning: 'text-amber-600', info: 'text-gray-400' } as const

  const metrics = [
    { label: 'MRR', value: money(mrrCents / 100) },
    { label: 'ARR (run-rate)', value: money((mrrCents * 12) / 100) },
    { label: 'Churn (90d)', value: `${churnRate}%` },
    { label: 'Total Users', value: totalUsers.toLocaleString() },
    { label: 'Staff / Owners / Board / Vendors', value: `${staffCount} / ${ownersCount ?? 0} / ${boardCount ?? 0} / ${vendorsCount ?? 0}` },
    { label: 'New Owners This Month', value: newOwnersMonth ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-950">
          <Sparkles className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Platform Intelligence</h1>
          <p className="mt-0.5 text-sm leading-6 text-gray-500">
            Executive briefing across every company — {counts.critical} critical · {counts.warning} warnings · {counts.info} advisories
          </p>
        </div>
      </div>

      {/* ── Executive metrics ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((m) => (
          <div key={m.label} className={`${card} px-4 py-3.5`}>
            <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{m.label}</div>
            <div className="mt-1.5 truncate text-xl font-semibold tabular-nums text-gray-950">{m.value}</div>
          </div>
        ))}
      </div>

      {insights.length === 0 ? (
        <div className={`${card} px-5 py-14 text-center`}>
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          <div className="text-sm font-semibold text-gray-950">All clear</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            No platform risks detected. Items appear here when companies go quiet, trials or renewals approach,
            door limits are exceeded, invoices age, or delivery infrastructure fails.
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
                    <div className="text-sm font-semibold text-gray-950">{ins.title}</div>
                    <p className="mt-0.5 text-[13px] leading-5 text-gray-600">{ins.detail}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <p className="text-xs leading-5 text-gray-400">
        <Users className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        Computed live from subscriptions, billing usage, invoices, logins, and delivery queues — deterministic rules, no fabricated data.
      </p>
    </div>
  )
}
