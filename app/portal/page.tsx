import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { Badge, Alert } from '@/components/ui/shell'
import { StatusChip } from '@/components/operations/status-chip'
import { Button } from '@/components/ui/button'
import { money, date } from '@/lib/utils'
import { htmlToPlainText } from '@/lib/security/rich-text'
import { CreditCard, Wrench, MessageSquare, Shield, FileText, Calendar, Siren, Phone, Mail, Sparkles } from 'lucide-react'
import { ownerTenureCutoffs, tenureFilter } from './_lib/tenure'

export const dynamic = 'force-dynamic'

export default async function OwnerDashboard() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any
  // Every owner record of the login (one per association).
  const ownerIds = me.owner_ids
  // Sections whose read failed — shown in an Alert instead of a silent zero.
  const loadErrors: string[] = []
  const track = (label: string, error: { message?: string } | null | undefined) => { if (error) loadErrors.push(`${label} (${error.message ?? 'error'})`) }

  // Two waves of parallel reads (they were ~13 sequential round trips):
  // first what needs only the login's owner records, then what needs their units.
  const none = Promise.resolve({ data: null, error: null, count: null })
  // Owner info + unit (occupancies has no archived_at column)
  // Current occupancies only: a sold unit must not keep showing its new
  // owner's balance, payments and work orders (board RLS would allow it).
  const [occRes, tenure, violRes, violCountRes] = await Promise.all([
    db.from('occupancies').select('id, unit_id, association_id, dues_amount, dues_paid_through, share_pct').in('owner_id', ownerIds).eq('status', 'current').order('is_primary', { ascending: false }).limit(20),
    // Work orders and payments (linked to a unit, not an owner) show only from
    // the owner's own tenure on, so a buyer never sees the seller's.
    ownerTenureCutoffs(db, ownerIds),
    // Violations
    db.from('violations').select('id,title,status,date_observed').in('owner_id', ownerIds).is('archived_at', null).not('status','in','("closed","cured")').order('date_observed', { ascending: false }).limit(5),
    db.from('violations').select('id', { count: 'exact', head: true }).in('owner_id', ownerIds).is('archived_at', null).not('status','in','("closed","cured")'),
  ])
  track('your units', occRes.error)
  const occs: any[] = occRes.data ?? []
  const unitIds = occs.map((o: any) => o.unit_id).filter(Boolean)
  const assocId = occs[0]?.association_id
  track('violations', violRes.error ?? violCountRes.error)
  const violations = violRes.data ?? []
  const openViolations = violCountRes.count ?? 0
  // Every association the owner holds a unit in, not just the primary one
  // (a login can hold one owner record per association).
  const assocIds = [...new Set(occs.map((o: any) => o.association_id).filter(Boolean))] as string[]
  const woScope = tenureFilter(tenure, 'created_at', unitIds)
  const paymentScope = tenureFilter(tenure, 'payment_date', unitIds)

  // Management contact — public branding fields only, resolved server-side.
  const loadSupport = async (): Promise<{ name: string | null; email: string | null; phone: string | null } | null> => {
    if (!assocId) return null
    try {
      const svc = createServiceClient() as any
      const { data: assoc } = await svc.from('associations').select('portfolio_id').eq('id', assocId).maybeSingle()
      if (!assoc?.portfolio_id) return null
      const { data: pf } = await svc.from('portfolios').select('company_name, support_email, support_phone').eq('id', assoc.portfolio_id).maybeSingle()
      return pf ? { name: pf.company_name ?? null, email: pf.support_email ?? null, phone: pf.support_phone ?? null } : null
    } catch { return null }
  }

  const [dueRes, balRes, woRes, woCountRes, evRes, annRes, payRes, emRes, support] = await Promise.all([
    // Next Due = the earliest open charge's due date on the owner's units.
    unitIds.length > 0
      ? db.from('v_charge_balances').select('due_date').in('unit_id', unitIds).gt('balance_due', 0).not('due_date', 'is', null).order('due_date', { ascending: true }).limit(1).maybeSingle()
      : none,
    // Current balance = outstanding A/R (charges − payments) across the owner's units
    unitIds.length > 0 ? db.from('unit_balances').select('balance').in('unit_id', unitIds) : none,
    woScope ? db.from('work_orders').select('id,title,status,created_at').or(woScope).is('archived_at', null).order('created_at', { ascending: false }).limit(5) : none,
    // Counts come from their own head queries — the lists are capped at 5.
    woScope ? db.from('work_orders').select('id', { count: 'exact', head: true }).or(woScope).is('archived_at', null).not('status', 'in', '("done","completed","billed","closed","cancelled")') : none,
    // Calendar
    assocIds.length > 0 ? db.from('calendar_events').select('id,title,start_datetime,location').in('association_id', assocIds).is('archived_at', null).gte('start_datetime', new Date().toISOString()).order('start_datetime').limit(5) : none,
    // Announcements — owner-facing only: tenant-only announcements are not for owners.
    assocIds.length > 0
      ? db.from('communications_log').select('id,subject,body,created_at').in('association_id', assocIds).eq('channel','announcement')
        .or('announcement_audience.is.null,announcement_audience.in.(owners,both)')
        .order('created_at',{ascending:false}).limit(3)
      : none,
    // Recent payments on the owner's units, from their own move-in on.
    paymentScope ? db.from('payments').select('id, amount, payment_date, method, reversed_at').or(paymentScope).order('payment_date', { ascending: false }).limit(5) : none,
    // Emergency notice: open emergency-priority work orders in the owner's
    // communities. Residents can't read those rows via RLS, so a SECURITY
    // DEFINER RPC returns just the title + created_at.
    occs.length > 0 ? db.rpc('owner_open_emergencies') : none,
    loadSupport(),
  ])

  track('next due date', dueRes.error)
  let nextDue = 'Nothing due'
  if (dueRes.data?.due_date) {
    nextDue = new Date(`${String(dueRes.data.due_date).slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })
  }
  track('balance', balRes.error)
  const totalDue = ((balRes.data ?? []) as any[]).reduce((s: number, b: any) => s + Number(b.balance ?? 0), 0)
  track('work orders', woRes.error)
  const workOrders: any[] = woRes.data ?? []
  track('open work order count', woCountRes.error)
  const openWOCount = woCountRes.count ?? 0
  track('events', evRes.error)
  const events: any[] = evRes.data ?? []
  track('announcements', annRes.error)
  const announcements: any[] = ((annRes.data ?? []) as any[]).map((a) => ({ ...a, preview: htmlToPlainText(a.body) }))
  track('payments', payRes.error)
  const recentPayments: any[] = payRes.data ?? []
  const emergencies: { title: string; created_at: string }[] = ((emRes.data ?? []) as { title: string; created_at: string }[]).slice(0, 3)

  const card = 'rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500">Welcome back</p>
          <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">{me.profile?.full_name ?? 'Owner'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/portal/ledger">
            <Button variant="secondary">Account Ledger</Button>
          </Link>
          <Link href="/portal/pay">
            <Button><CreditCard className="h-4 w-4" /> Pay Assessments</Button>
          </Link>
        </div>
      </div>

      {loadErrors.length > 0 && (
        <Alert tone="danger" title="Some of your account could not be loaded:">{loadErrors.join('; ')}. Figures shown may be incomplete — please refresh.</Alert>
      )}

      {/* Emergency notice */}
      {emergencies.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4">
          <div className="flex items-start gap-3">
            <Siren className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <div className="text-sm font-semibold text-red-800">Emergency work in progress in your community</div>
              <p className="mt-0.5 text-[13px] text-red-700">{emergencies.map((e) => e.title).join(' · ')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Current Balance', value: money(totalDue), color: totalDue > 0 ? 'text-red-700' : 'text-emerald-700', href: '/portal/ledger', hint: 'View ledger' },
          { label: 'Open Work Orders', value: openWOCount, color: 'text-gray-950' },
          { label: 'Open Violations', value: openViolations, color: openViolations > 0 ? 'text-amber-700' : 'text-gray-950' },
          { label: 'Next Due', value: occs.length > 0 ? nextDue : '—', color: 'text-gray-950' },
        ].map(s => {
          const inner = (
            <>
              <div className="text-[13px] font-medium leading-5 text-gray-500">{s.label}</div>
              <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${s.color}`}>{s.value}</div>
              {s.hint && <div className="mt-1 text-[12.5px] font-medium text-gray-500">{s.hint} →</div>}
            </>
          )
          const cls = 'rounded-2xl border border-line bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
          return s.href
            ? <Link key={s.label} href={s.href} className={cls + ' block transition hover:border-gray-300 hover:bg-gray-50/60'}>{inner}</Link>
            : <div key={s.label} className={cls}>{inner}</div>
        })}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Pay Assessments', icon: CreditCard, href: '/portal/pay', primary: true },
          { label: 'Account Ledger', icon: FileText, href: '/portal/ledger' },
          { label: 'Submit Work Order', icon: Wrench, href: '/portal/work-orders/new' },
          { label: 'Contact Management', icon: MessageSquare, href: '/portal/communications' },
          { label: 'Upload Insurance', icon: Shield, href: '/portal/insurance' },
          { label: 'Calendar', icon: Calendar, href: '/portal/calendar' },
        ].map(a => (
          <Link key={a.label} href={a.href} className={
            a.primary
              ? 'flex flex-col items-center gap-2 rounded-2xl border border-gray-950 bg-gray-950 p-4 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-gray-800'
              : 'flex flex-col items-center gap-2 rounded-2xl border border-line bg-white p-4 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-gray-300 hover:bg-gray-50/60'
          }>
            <a.icon className={a.primary ? 'h-6 w-6 text-white/80' : 'h-6 w-6 text-accent'} />
            <span className={a.primary ? 'text-[13.5px] font-semibold text-white' : 'text-[13.5px] font-medium text-gray-800'}>{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Content sections */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Work Orders */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Recent Work Orders</h2>
            <Link href="/portal/work-orders" className="text-sm font-medium text-gray-500 hover:text-gray-950 hover:underline">View all</Link>
          </div>
          {workOrders.length === 0 ? (
            <p className="py-4 text-sm text-gray-400">No work orders submitted yet.</p>
          ) : (
            <div className="space-y-1">
              {workOrders.map((w: any) => (
                <Link key={w.id} href={`/portal/work-orders/${w.id}`} className="-mx-3 flex items-center justify-between gap-3 rounded-xl border-b border-gray-50 px-3 py-2 last:border-0 hover:bg-gray-50/60">
                  <span className="truncate text-sm text-gray-900">{w.title}</span>
                  <Badge status={w.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Violations */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Violations</h2>
            <Link href="/portal/violations" className="text-sm font-medium text-gray-500 hover:text-gray-950 hover:underline">View all</Link>
          </div>
          {violations.length === 0 ? (
            <p className="py-4 text-sm text-gray-400">No open violations.</p>
          ) : (
            <div className="space-y-1">
              {violations.map((v: any) => (
                <Link key={v.id} href={`/portal/violations/${v.id}`} className="-mx-3 flex items-center justify-between gap-3 rounded-xl border-b border-gray-50 px-3 py-2 last:border-0 hover:bg-gray-50/60">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-gray-900">{v.title}</div>
                    <div className="text-[13px] text-gray-500">{date(v.date_observed)}</div>
                  </div>
                  <Badge status={v.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Upcoming Events</h2>
            <Link href="/portal/calendar" className="text-sm font-medium text-gray-500 hover:text-gray-950 hover:underline">View calendar</Link>
          </div>
          {events.length === 0 ? (
            <p className="py-4 text-sm text-gray-400">No upcoming events.</p>
          ) : (
            <div className="space-y-1">
              {events.map((e: any) => (
                <div key={e.id} className="flex items-start gap-3 border-b border-gray-50 py-2 last:border-0">
                  <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-900">{e.title}</div>
                    <div className="text-[13px] text-gray-500">{date(e.start_datetime)} {e.location ? `— ${e.location}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Announcements */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Announcements</h2>
            <Link href="/portal/communications" className="text-sm font-medium text-gray-500 hover:text-gray-950 hover:underline">View all</Link>
          </div>
          {announcements.length === 0 ? (
            <p className="py-4 text-sm text-gray-400">No recent announcements.</p>
          ) : (
            <div className="space-y-1">
              {announcements.map((a: any, i: number) => (
                <div key={a.id ?? i} className="border-b border-gray-50 py-2 last:border-0">
                  <div className="text-sm text-gray-900">{a.subject}</div>
                  {/* Stored as HTML; shown as a plain-text preview, never as markup. */}
                  {a.preview && <p className="mt-0.5 line-clamp-2 break-words text-xs leading-5 text-gray-600">{a.preview}</p>}
                  <div className="text-[13px] text-gray-500">{date(a.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent payments */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Recent Payments</h2>
            <Link href="/portal/ledger" className="text-sm font-medium text-gray-500 hover:text-gray-950 hover:underline">Full ledger</Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="py-4 text-sm text-gray-400">No payments recorded yet.</p>
          ) : (
            <div className="space-y-1">
              {recentPayments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between border-b border-gray-50 py-2 last:border-0">
                  <div>
                    <div className={p.reversed_at ? 'text-sm text-gray-400 line-through' : 'text-sm text-gray-900'}>{money(Number(p.amount ?? 0))}</div>
                    <div className="text-xs capitalize text-gray-500">{(p.method ?? 'payment').replace(/_/g, ' ')}</div>
                  </div>
                  {p.reversed_at && <StatusChip tone="danger">Returned</StatusChip>}
                  <div className="text-xs tabular-nums text-gray-500">{date(p.payment_date)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact management */}
        <div className={card}>
          <h2 className="mb-4 text-sm font-semibold text-gray-950">Your Management Company</h2>
          {support ? (
            <div className="space-y-2.5">
              {support.name && <div className="text-sm font-medium text-gray-900">{support.name}</div>}
              {support.email && (
                <a href={`mailto:${support.email}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-950 hover:underline">
                  <Mail className="h-4 w-4 text-gray-400" /> {support.email}
                </a>
              )}
              {support.phone && (
                <a href={`tel:${support.phone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-950 hover:underline">
                  <Phone className="h-4 w-4 text-gray-400" /> {support.phone}
                </a>
              )}
              <Link href="/portal/communications" className="inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-gray-600 hover:text-gray-950 hover:underline">
                <MessageSquare className="h-4 w-4 text-gray-400" /> Send a message
              </Link>
            </div>
          ) : (
            <p className="py-2 text-sm text-gray-400">Contact details will appear here once your management company adds them.</p>
          )}
        </div>
      </div>
    </div>
  )
}
