import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { money, date } from '@/lib/utils'
import { CreditCard, Wrench, AlertTriangle, MessageSquare, Shield, FileText, Calendar } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OwnerDashboard() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any
  const ownerId = me.owner_id

  // Owner info + unit
  const { data: occupancies } = await db.from('occupancies').select('id, unit_id, association_id, dues_amount, dues_paid_through, share_pct').eq('owner_id', ownerId).is('archived_at', null).limit(5)
  const occs = occupancies ?? []
  const totalDue = occs.reduce((s: number, o: any) => s + (o.dues_amount ?? 0), 0)
  const nextDue = occs[0]?.dues_paid_through 
    ? new Date(occs[0].dues_paid_through).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Not set'
  const assocId = occs[0]?.association_id

  // Work orders
  const { data: wos } = await db.from('work_orders').select('id,title,status,created_at').eq('owner_id', ownerId).is('archived_at', null).order('created_at', { ascending: false }).limit(5)
  const workOrders = wos ?? []
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

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-gray-500">Welcome back</p>
        <h1 className="text-3xl font-bold text-gray-900">{me.profile?.full_name ?? 'Owner'}</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Current Balance', value: money(totalDue), color: totalDue > 0 ? 'text-red-600' : 'text-emerald-600' },
          { label: 'Open Work Orders', value: openWO.length, color: openWO.length > 0 ? 'text-blue-600' : 'text-gray-600' },
          { label: 'Open Violations', value: violations.length, color: violations.length > 0 ? 'text-amber-600' : 'text-gray-600' },
          { label: 'Next Due', value: occs.length > 0 ? nextDue : '—', color: 'text-gray-900' },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-white border border-gray-200 p-5 shadow-sm">
            <div className="text-xs font-medium uppercase text-gray-500">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Pay Assessment', icon: CreditCard, href: '/portal/pay', color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'Submit Work Order', icon: Wrench, href: '/portal/work-orders/new', color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'Contact Management', icon: MessageSquare, href: '/portal/communications', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { label: 'Upload Insurance', icon: Shield, href: '/portal/insurance', color: 'bg-purple-50 text-purple-700 border-purple-200' },
          { label: 'View Documents', icon: FileText, href: '/portal/documents', color: 'bg-gray-50 text-gray-700 border-gray-200' },
          { label: 'Calendar', icon: Calendar, href: '/portal/calendar', color: 'bg-sky-50 text-sky-700 border-sky-200' },
        ].map(a => (
          <Link key={a.label} href={a.href} className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition hover:shadow-md ${a.color}`}>
            <a.icon className="h-6 w-6" />
            <span className="text-xs font-medium">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Content sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Work Orders */}
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Work Orders</h2>
            <Link href="/portal/work-orders" className="text-sm text-blue-600 hover:text-blue-800">View all</Link>
          </div>
          {workOrders.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No work orders submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {workOrders.map((w: any) => (
                <Link key={w.id} href={`/portal/work-orders/${w.id}`} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-3 px-3 rounded">
                  <span className="text-sm text-gray-800">{w.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${w.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : w.status === 'in_progress' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{w.status.replace('_',' ')}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Violations */}
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Violations</h2>
            <Link href="/portal/violations" className="text-sm text-blue-600 hover:text-blue-800">View all</Link>
          </div>
          {violations.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No open violations.</p>
          ) : (
            <div className="space-y-3">
              {violations.map((v: any) => (
                <Link key={v.id} href={`/portal/violations/${v.id}`} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-3 px-3 rounded">
                  <div>
                    <div className="text-sm text-gray-800">{v.title}</div>
                    <div className="text-xs text-gray-500">{date(v.date_observed)}</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full capitalize bg-amber-50 text-amber-700">{v.status.replace('_',' ')}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Upcoming Events</h2>
            <Link href="/portal/calendar" className="text-sm text-blue-600 hover:text-blue-800">View calendar</Link>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No upcoming events.</p>
          ) : (
            <div className="space-y-3">
              {events.map((e: any) => (
                <div key={e.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                  <Calendar className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm text-gray-800">{e.title}</div>
                    <div className="text-xs text-gray-500">{date(e.start_datetime)} {e.location ? `— ${e.location}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Announcements */}
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Announcements</h2>
            <Link href="/portal/communications" className="text-sm text-blue-600 hover:text-blue-800">View all</Link>
          </div>
          {announcements.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No recent announcements.</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((a: any, i: number) => (
                <div key={i} className="py-2 border-b border-gray-100 last:border-0">
                  <div className="text-sm text-gray-800">{a.subject}</div>
                  <div className="text-xs text-gray-500">{date(a.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
