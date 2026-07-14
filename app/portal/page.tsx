import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { Badge } from '@/components/ui/shell'
import { Button } from '@/components/ui/button'
import { money, date } from '@/lib/utils'
import { CreditCard, Wrench, MessageSquare, Shield, FileText, Calendar, Siren, Phone, Mail, Sparkles } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OwnerDashboard() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any
  const ownerId = me.owner_id

  // Owner info + unit (occupancies has no archived_at column)
  const { data: occupancies } = await db.from('occupancies').select('id, unit_id, association_id, dues_amount, dues_paid_through, share_pct').eq('owner_id', ownerId).limit(5)
  const occs = occupancies ?? []
  const unitIds = occs.map((o: any) => o.unit_id).filter(Boolean)
  const nextDue = occs[0]?.dues_paid_through
    ? new Date(occs[0].dues_paid_through).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Not set'
  const assocId = occs[0]?.association_id

  // Current balance = outstanding A/R (charges − payments) across the owner's units
  let totalDue = 0
  if (unitIds.length > 0) {
    const { data: bals } = await db.from('unit_balances').select('balance').in('unit_id', unitIds)
    totalDue = (bals ?? []).reduce((s: number, b: any) => s + Number(b.balance ?? 0), 0)
  }

  // Work orders (work_orders links to a unit, not an owner)
  let workOrders: any[] = []
  if (unitIds.length > 0) {
    const { data: wos } = await db.from('work_orders').select('id,title,status,created_at').in('unit_id', unitIds).is('archived_at', null).order('created_at', { ascending: false }).limit(5)
    workOrders = wos ?? []
  }
  const openWO = workOrders.filter((w: any) => !['completed','closed','cancelled'].includes(w.status))

  // Violations
  const { data: viols } = await db.from('violations').select('id,title,status,date_observed').eq('owner_id', ownerId).is('archived_at', null).not('status','in','("closed","cured")').order('date_observed', { ascending: false }).limit(5)
  const violations = viols ?? []

  // Calendar
  let events: any[] = []
  if (assocId) {
    const { data: ev } = await db.from('calendar_events').select('id,title,start_datetime,location').eq('association_id', assocId).gte('start_datetime', new Date().toISOString()).order('start_datetime').limit(5)
    events = ev ?? []
  }

  // Announcements
  let announcements: any[] = []
  if (assocId) {
    try {
      const { data: ann } = await db.from('communications_log').select('subject,created_at').eq('association_id', assocId).eq('channel','announcement').order('created_at',{ascending:false}).limit(3)
      announcements = ann ?? []
    } catch {}
  }

  // Recent payments on the owner's units
  let recentPayments: any[] = []
  if (unitIds.length > 0) {
    const { data: pays } = await db.from('payments').select('id, amount, payment_date, method').in('unit_id', unitIds).order('payment_date', { ascending: false }).limit(5)
    recentPayments = pays ?? []
  }

  // Emergency notice: any open emergency-priority work order in the community
  let emergencies: any[] = []
  if (assocId) {
    const { data: em } = await db.from('work_orders').select('id, title').eq('association_id', assocId).eq('priority', 'emergency').is('archived_at', null).in('status', ['new', 'assigned', 'scheduled', 'in_progress']).limit(3)
    emergencies = em ?? []
  }

  // Management contact — public branding fields only, resolved server-side.
  let support: { name: string | null; email: string | null; phone: string | null } | null = null
  if (assocId) {
    try {
      const svc = createServiceClient() as any
      const { data: assoc } = await svc.from('associations').select('portfolio_id').eq('id', assocId).maybeSingle()
      if (assoc?.portfolio_id) {
        const { data: pf } = await svc.from('portfolios').select('company_name, support_email, support_phone').eq('id', assoc.portfolio_id).maybeSingle()
        if (pf) support = { name: pf.company_name ?? null, email: pf.support_email ?? null, phone: pf.support_phone ?? null }
      }
    } catch {}
  }

  const card = 'rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500">Welcome back</p>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">{me.profile?.full_name ?? 'Owner'}</h1>
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

      {/* Emergency notice */}
      {emergencies.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4">
          <div className="flex items-start gap-3">
            <Siren className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <div className="text-sm font-semibold text-red-800">Emergency work in progress in your community</div>
              <p className="mt-0.5 text-[13px] text-red-700">{emergencies.map((e: any) => e.title).join(' · ')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Current Balance', value: money(totalDue), color: totalDue > 0 ? 'text-red-700' : 'text-emerald-700', href: '/portal/ledger', hint: 'View ledger' },
          { label: 'Open Work Orders', value: openWO.length, color: 'text-gray-950' },
          { label: 'Open Violations', value: violations.length, color: violations.length > 0 ? 'text-amber-700' : 'text-gray-950' },
          { label: 'Next Due', value: occs.length > 0 ? nextDue : '—', color: 'text-gray-950' },
        ].map(s => {
          const inner = (
            <>
              <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{s.label}</div>
              <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${s.color}`}>{s.value}</div>
              {s.hint && <div className="mt-1 text-[11px] font-medium text-gray-500">{s.hint} →</div>}
            </>
          )
          const cls = 'rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
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
              : 'flex flex-col items-center gap-2 rounded-2xl border border-gray-200/70 bg-white p-4 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-gray-300 hover:bg-gray-50/60'
          }>
            <a.icon className={a.primary ? 'h-6 w-6 text-white/80' : 'h-6 w-6 text-gray-400'} />
            <span className={a.primary ? 'text-xs font-semibold text-white' : 'text-xs font-medium text-gray-700'}>{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Content sections */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Work Orders */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-950">Recent Work Orders</h2>
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
            <h2 className="text-sm font-semibold text-gray-950">Violations</h2>
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
                    <div className="text-xs text-gray-500">{date(v.date_observed)}</div>
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
            <h2 className="text-sm font-semibold text-gray-950">Upcoming Events</h2>
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
                    <div className="text-xs text-gray-500">{date(e.start_datetime)} {e.location ? `— ${e.location}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Announcements */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-950">Announcements</h2>
            <Link href="/portal/communications" className="text-sm font-medium text-gray-500 hover:text-gray-950 hover:underline">View all</Link>
          </div>
          {announcements.length === 0 ? (
            <p className="py-4 text-sm text-gray-400">No recent announcements.</p>
          ) : (
            <div className="space-y-1">
              {announcements.map((a: any, i: number) => (
                <div key={i} className="border-b border-gray-50 py-2 last:border-0">
                  <div className="text-sm text-gray-900">{a.subject}</div>
                  <div className="text-xs text-gray-500">{date(a.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent payments */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-950">Recent Payments</h2>
            <Link href="/portal/ledger" className="text-sm font-medium text-gray-500 hover:text-gray-950 hover:underline">Full ledger</Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="py-4 text-sm text-gray-400">No payments recorded yet.</p>
          ) : (
            <div className="space-y-1">
              {recentPayments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between border-b border-gray-50 py-2 last:border-0">
                  <div>
                    <div className="text-sm text-gray-900">{money(Number(p.amount ?? 0))}</div>
                    <div className="text-xs capitalize text-gray-500">{(p.method ?? 'payment').replace(/_/g, ' ')}</div>
                  </div>
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
