import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { money, date } from '@/lib/utils'
import { CreditCard, Wrench, AlertTriangle, Shield, MessageSquare, Calendar, Undo2 } from 'lucide-react'
import { Alert } from '@/components/ui/shell'
import { ownerTenureCutoffs, tenureFilter } from '../_lib/tenure'

export const dynamic = 'force-dynamic'

export default async function OwnerTimelinePage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any
  // Every owner record of the login (one per association).
  const ownerIds = me.owner_ids

  // Work orders have no owner_id — resolve via the owner's current units.
  // Use occupancies (status='current') so this matches the work_orders RLS
  // predicate current_resident_unit_ids(); otherwise the work-order section is
  // silently empty when unit_owners and occupancies disagree.
  const { data: myUnits } = await db.from('occupancies').select('unit_id').in('owner_id', ownerIds).eq('status', 'current')
  const unitIds = (myUnits ?? []).map((u: any) => u.unit_id)
  // Payments only from the owner's own move-in on (a buyer must not see the seller's).
  const tenure = await ownerTenureCutoffs(db, ownerIds)
  const paymentScope = tenureFilter(tenure, 'payment_date', unitIds)
  // Same for work orders: only those opened during the owner's tenure.
  const woScope = tenureFilter(tenure, 'created_at', unitIds)

  const [paymentsRes, returnsRes, wosRes, violsRes, msgsRes] = await Promise.all([
    // By the owner's current units, like the ledger. Read payments directly so
    // returned (reversed) payments are labelled as they are on the ledger.
    paymentScope
      ? db.from('payments').select('amount, payment_date, method').or(paymentScope).order('payment_date', { ascending: false }).limit(30)
      : Promise.resolve({ data: [], error: null }),
    // A return is its own event, dated when the payment came back (which can
    // be long after the payment date). The effective return date staff chose
    // is the reversal charge's due date (the view's reversal_date); fetch and
    // order returns by it, falling back to when the return was entered.
    paymentScope
      ? db.from('receivable_payments_ledger').select('amount, method, reversed_at, reversal_reason, reversal_date').or(paymentScope).not('reversed_at', 'is', null)
          .order('reversal_date', { ascending: false, nullsFirst: false }).order('reversed_at', { ascending: false }).limit(30)
      : Promise.resolve({ data: [], error: null }),
    woScope
      ? db.from('work_orders').select('id, title, status, created_at').or(woScope).is('archived_at', null).order('created_at', { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
    db.from('violations').select('id, title, status, date_observed').in('owner_id', ownerIds).is('archived_at', null).order('date_observed', { ascending: false }).limit(30),
    // sender_id holds the auth user id, not the owner id (matches /portal/communications)
    db.from('communications_log').select('subject, channel, status, created_at').eq('sender_id', me.auth_user_id).order('created_at', { ascending: false }).limit(30),
  ])

  interface Entry { date: string; icon: any; title: string; detail: string; color: string; }
  const entries: Entry[] = []

  for (const p of paymentsRes?.data ?? []) {
    entries.push({ date: p.payment_date, icon: CreditCard, title: 'Payment', detail: money(p.amount) + ' via ' + (p.method ?? '—'), color: 'text-emerald-600 bg-emerald-50' })
  }
  for (const p of returnsRes?.data ?? []) {
    entries.push({ date: p.reversal_date ?? p.reversed_at, icon: Undo2, title: 'Payment returned', detail: money(p.amount) + ' via ' + (p.method ?? '—') + (p.reversal_reason ? ` · ${p.reversal_reason}` : ''), color: 'text-red-600 bg-red-50' })
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
  const loadError = paymentsRes?.error ?? returnsRes?.error ?? wosRes?.error ?? violsRes?.error ?? msgsRes?.error

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Activity Timeline</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">All activity on your account in one place</p>
      </div>

      {loadError && (
        <Alert tone="danger" title="Could not load all of your activity:">{loadError.message}. The timeline below may be incomplete — please refresh.</Alert>
      )}

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
                  <span className="text-[13px] text-gray-500">{date(e.date)}</span>
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
