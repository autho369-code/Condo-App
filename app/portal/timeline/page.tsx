import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { money, date } from '@/lib/utils'
import { CreditCard, Wrench, AlertTriangle, Shield, MessageSquare, Calendar } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OwnerTimelinePage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any
  const ownerId = me.owner_id

  // Work orders have no owner_id — resolve via the owner's units
  const { data: myUnits } = await db.from('unit_owners').select('unit_id').eq('owner_id', ownerId)
  const unitIds = (myUnits ?? []).map((u: any) => u.unit_id)

  const [paymentsRes, wosRes, violsRes, msgsRes] = await Promise.all([
    db.from('receivable_payments_ledger').select('amount, payment_date, method').eq('owner_id', ownerId).order('payment_date', { ascending: false }).limit(30),
    unitIds.length > 0
      ? db.from('work_orders').select('id, title, status, created_at').in('unit_id', unitIds).is('archived_at', null).order('created_at', { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
    db.from('violations').select('id, title, status, date_observed').eq('owner_id', ownerId).is('archived_at', null).order('date_observed', { ascending: false }).limit(30),
    db.from('communications_log').select('subject, channel, status, created_at').eq('sender_id', ownerId).order('created_at', { ascending: false }).limit(30),
  ])

  interface Entry { date: string; icon: any; title: string; detail: string; color: string; }
  const entries: Entry[] = []

  for (const p of paymentsRes?.data ?? []) {
    entries.push({ date: p.payment_date, icon: CreditCard, title: 'Payment', detail: money(p.amount) + ' via ' + (p.method ?? '—'), color: 'text-emerald-600 bg-emerald-50' })
  }
  for (const w of wosRes?.data ?? []) {
    entries.push({ date: w.created_at, icon: Wrench, title: `Work Order: ${w.title}`, detail: w.status.replace('_',' '), color: 'text-blue-600 bg-blue-50' })
  }
  for (const v of violsRes?.data ?? []) {
    entries.push({ date: v.date_observed, icon: AlertTriangle, title: `Violation: ${v.title}`, detail: v.status.replace('_',' '), color: 'text-amber-600 bg-amber-50' })
  }
  for (const m of msgsRes?.data ?? []) {
    entries.push({ date: m.created_at, icon: MessageSquare, title: m.subject || 'Message', detail: m.channel ?? 'message', color: 'text-purple-600 bg-purple-50' })
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Activity Timeline</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">All activity on your account in one place</p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="relative pl-8 border-l-2 border-gray-200 space-y-6">
          {entries.map((e, i) => (
            <div key={i} className="relative">
              <div className={`absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-white ${e.color.split(' ')[1]}`}>
                <e.icon className={`h-3 w-3 ${e.color.split(' ')[0]}`} />
              </div>
              <div className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900 text-sm">{e.title}</div>
                  <span className="text-xs text-gray-400">{date(e.date)}</span>
                </div>
                <div className="text-sm text-gray-500 mt-0.5 capitalize">{e.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
