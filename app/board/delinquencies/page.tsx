import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { date, money } from '@/lib/utils'
import {
  Clock,
  AlertTriangle,
  DollarSign,
  Users,
  Calendar,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'emerald',
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: React.ElementType
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'violet'
}) {
  const accents: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  }
  return (
    <div className="rounded-xl border border-[#1E293B] p-4 transition-colors hover:border-[#334155]" style={{ backgroundColor: '#0B1121' }}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-white">{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function daysPastDue(paidThrough: string | null): number {
  if (!paidThrough) return 0
  const d = new Date(paidThrough)
  const today = new Date()
  return Math.floor((today.getTime() - d.getTime()) / 86400000)
}

export default async function BoardDelinquenciesPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const boardAssocIds = me.board_association_ids ?? []

  if (boardAssocIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Delinquencies</h1>
          <p className="mt-1 text-sm text-slate-400">Track delinquent accounts</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] p-12 text-center" style={{ backgroundColor: '#0B1121' }}>
          <AlertTriangle className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-4 text-slate-400">No associations assigned to your board membership.</p>
        </div>
      </div>
    )
  }

  const today = new Date()
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()
  const currentMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`

  // ── Fetch delinquent occupancies ──
  // Delinquent if dues_paid_through is before current month start
  let delinquentRows: any[] = []
  try {
    // First try the delinquent_units view if it exists
    const { data: delView } = await db
      .from('delinquent_units')
      .select('*')
      .in('association_id', boardAssocIds)
      .order('balance', { ascending: false })

    if (delView && delView.length > 0) {
      // Map to common format
      delinquentRows = delView.map((d: any) => ({
        unit_id: d.unit_id,
        unit_number: d.unit_number,
        owner_name: '—', // We'll need to look this up
        amount_due: d.balance ?? 0,
        days_past_due: d.oldest_due ? daysPastDue(d.oldest_due) : 0,
        last_payment_date: null,
        association_id: d.association_id,
        owner_id: null,
      }))
    } else {
      // Fall back to occupancies table
      const { data: occs } = await db
        .from('occupancies')
        .select(`id, unit_id, owner_id, dues_amount, dues_paid_through, association_id, units!occupancies_unit_id_fkey(unit_number), owners!occupancies_owner_id_fkey(full_name, email)`)
        .in('association_id', boardAssocIds)
        .eq('status', 'current')
        .lt('dues_paid_through', currentMonthStart)
        .order('dues_paid_through', { ascending: true })

      delinquentRows = (occs ?? []).map((o: any) => ({
        unit_id: o.unit_id,
        unit_number: o.units?.unit_number ?? '—',
        owner_name: o.owners?.full_name ?? 'Unknown',
        owner_email: o.owners?.email ?? null,
        amount_due: o.dues_amount ?? 0,
        days_past_due: daysPastDue(o.dues_paid_through),
        last_payment_date: null,
        association_id: o.association_id,
        owner_id: o.owner_id,
        occupancy_id: o.id,
        paid_through: o.dues_paid_through,
      }))
    }
  } catch {
    delinquentRows = []
  }

  // ── Calculate stats ──
  const totalDelinquentAmount = delinquentRows.reduce((sum, d) => sum + d.amount_due, 0)
  const avgDaysPastDue = delinquentRows.length > 0
    ? Math.round(delinquentRows.reduce((sum, d) => sum + d.days_past_due, 0) / delinquentRows.length)
    : 0

  // Try to get last payment dates where available
  try {
    const ownerIds = [...new Set(delinquentRows.map((d) => d.owner_id).filter(Boolean))]
    if (ownerIds.length > 0) {
      const { data: payments } = await db
        .from('payments')
        .select('owner_id, created_at')
        .in('owner_id', ownerIds)
        .order('created_at', { ascending: false })

      if (payments) {
        const lastPaymentMap = new Map<string, string>()
        payments.forEach((p: any) => {
          if (!lastPaymentMap.has(p.owner_id)) {
            lastPaymentMap.set(p.owner_id, p.created_at)
          }
        })
        delinquentRows.forEach((d) => {
          if (d.owner_id && lastPaymentMap.has(d.owner_id)) {
            d.last_payment_date = lastPaymentMap.get(d.owner_id)
          }
        })
      }
    }
  } catch { /* may not exist */ }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-white">Delinquencies</h1>
        <p className="mt-1 text-sm text-slate-400">
          Delinquent accounts across your association{boardAssocIds.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Delinquency"
          value={money(totalDelinquentAmount)}
          sub={`${delinquentRows.length} delinquent account${delinquentRows.length !== 1 ? 's' : ''}`}
          icon={DollarSign}
          accent={totalDelinquentAmount > 0 ? 'red' : 'emerald'}
        />
        <StatCard
          label="Delinquent Accounts"
          value={delinquentRows.length}
          sub="Active accounts past due"
          icon={Users}
          accent={delinquentRows.length > 5 ? 'red' : delinquentRows.length > 2 ? 'amber' : 'emerald'}
        />
        <StatCard
          label="Avg Days Past Due"
          value={`${avgDaysPastDue}d`}
          sub="Average delinquency age"
          icon={Clock}
          accent={avgDaysPastDue > 60 ? 'red' : avgDaysPastDue > 30 ? 'amber' : 'emerald'}
        />
      </div>

      {/* ── Delinquent Accounts Table ── */}
      <div className="overflow-x-auto rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
              <th className="px-4 py-3 text-left font-medium">Unit</th>
              <th className="px-4 py-3 text-left font-medium">Owner</th>
              <th className="px-4 py-3 text-right font-medium">Amount Due</th>
              <th className="px-4 py-3 text-right font-medium">Days Past Due</th>
              <th className="px-4 py-3 text-left font-medium">Last Payment</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {delinquentRows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center">
                <div className="text-slate-500">
                  <CheckCircleInline />
                  <p className="mt-2">No delinquent accounts found.</p>
                  <p className="mt-1 text-xs text-slate-600">All accounts are current.</p>
                </div>
              </td></tr>
            ) : (
              delinquentRows.map((row: any, idx: number) => {
                const isSevere = row.days_past_due > 90
                const isWarning = row.days_past_due > 60 && row.days_past_due <= 90
                const isModerate = row.days_past_due > 30 && row.days_past_due <= 60

                let statusBadge
                if (isSevere) {
                  statusBadge = <span className="inline-flex h-6 items-center rounded-full bg-red-500/10 px-2.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20">Severe</span>
                } else if (isWarning) {
                  statusBadge = <span className="inline-flex h-6 items-center rounded-full bg-amber-500/10 px-2.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">Warning</span>
                } else if (isModerate) {
                  statusBadge = <span className="inline-flex h-6 items-center rounded-full bg-yellow-500/10 px-2.5 text-xs font-medium text-yellow-400 ring-1 ring-yellow-500/20">Moderate</span>
                } else {
                  statusBadge = <span className="inline-flex h-6 items-center rounded-full bg-blue-500/10 px-2.5 text-xs font-medium text-blue-400 ring-1 ring-blue-500/20">Recent</span>
                }

                return (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className="text-slate-300">{row.unit_number ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300">{row.owner_name}</span>
                      {row.owner_email && (
                        <div className="text-xs text-slate-600">{row.owner_email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={isSevere ? 'text-red-400 font-bold' : 'text-amber-400'}>
                        {money(row.amount_due)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={
                        isSevere ? 'text-red-400 font-bold' :
                        isWarning ? 'text-amber-400' :
                        'text-slate-300'
                      }>
                        {row.days_past_due}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {row.last_payment_date ? date(row.last_payment_date) : '—'}
                    </td>
                    <td className="px-4 py-3">{statusBadge}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {delinquentRows.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/20 ring-1 ring-red-500/20" />
            Severe (&gt;90d)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-500/20 ring-1 ring-amber-500/20" />
            Warning (61-90d)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-yellow-500/20 ring-1 ring-yellow-500/20" />
            Moderate (31-60d)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-blue-500/20 ring-1 ring-blue-500/20" />
            Recent (&le;30d)
          </div>
        </div>
      )}
    </div>
  )
}

function CheckCircleInline() {
  return (
    <svg className="mx-auto h-10 w-10 text-emerald-500/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
