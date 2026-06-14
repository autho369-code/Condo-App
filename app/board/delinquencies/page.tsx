import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { StatusChip, type Tone } from '@/components/operations/status-chip'
import { date, money } from '@/lib/utils'
import {
  Clock,
  AlertTriangle,
  DollarSign,
  Users,
  CheckCircle2,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: React.ElementType
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
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
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Delinquencies</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Track delinquent accounts</p>
        </div>
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No associations assigned to your board membership.</p>
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

  // Resolve owner names + last payment date by UNIT (works for both the
  // delinquent_units view path and the occupancies fallback). Board members
  // can read unit_owners/owners/payments for their association via RLS.
  try {
    const unitIds = [...new Set(delinquentRows.map((d) => d.unit_id).filter(Boolean))]
    if (unitIds.length > 0) {
      const [{ data: uos }, { data: payments }] = await Promise.all([
        db.from('unit_owners').select('unit_id, owner_id, is_primary').in('unit_id', unitIds),
        db.from('payments').select('unit_id, payment_date').in('unit_id', unitIds).order('payment_date', { ascending: false }),
      ])

      const ownerIds = [...new Set((uos ?? []).map((u: any) => u.owner_id).filter(Boolean))]
      const ownerNameById = new Map<string, string>()
      if (ownerIds.length > 0) {
        const { data: owners } = await db.from('owners').select('id, full_name').in('id', ownerIds)
        for (const o of owners ?? []) ownerNameById.set(o.id, o.full_name)
      }

      // Prefer the primary owner for each unit
      const ownerByUnit = new Map<string, string>()
      for (const r of [...(uos ?? [])].sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))) {
        if (!ownerByUnit.has(r.unit_id)) ownerByUnit.set(r.unit_id, ownerNameById.get(r.owner_id) ?? '')
      }

      const lastPayByUnit = new Map<string, string>()
      for (const p of payments ?? []) {
        if (!lastPayByUnit.has(p.unit_id)) lastPayByUnit.set(p.unit_id, p.payment_date)
      }

      delinquentRows.forEach((d) => {
        if (!d.owner_name || d.owner_name === '—' || d.owner_name === 'Unknown') {
          d.owner_name = ownerByUnit.get(d.unit_id) || '—'
        }
        if (!d.last_payment_date) d.last_payment_date = lastPayByUnit.get(d.unit_id) ?? null
      })
    }
  } catch { /* may not exist */ }

  const severity = (days: number): { tone: Tone; label: string } => {
    if (days > 90) return { tone: 'danger', label: 'Severe' }
    if (days > 60) return { tone: 'warning', label: 'Warning' }
    if (days > 30) return { tone: 'warning', label: 'Moderate' }
    return { tone: 'info', label: 'Recent' }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Delinquencies</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Delinquent accounts across your association{boardAssocIds.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total Delinquency"
          value={money(totalDelinquentAmount)}
          sub={`${delinquentRows.length} delinquent account${delinquentRows.length !== 1 ? 's' : ''}`}
          icon={DollarSign}
        />
        <StatCard
          label="Delinquent Accounts"
          value={delinquentRows.length}
          sub="Active accounts past due"
          icon={Users}
        />
        <StatCard
          label="Avg Days Past Due"
          value={`${avgDaysPastDue}d`}
          sub="Average delinquency age"
          icon={Clock}
        />
      </div>

      {/* ── Delinquent Accounts Table ── */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Unit</th>
              <th className="px-4 py-2.5 text-left font-medium">Owner</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount Due</th>
              <th className="px-4 py-2.5 text-right font-medium">Days Past Due</th>
              <th className="px-4 py-2.5 text-left font-medium">Last Payment</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {delinquentRows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm font-semibold text-gray-900">No delinquent accounts found.</p>
                <p className="mt-1 text-sm text-gray-500">All accounts are current.</p>
              </td></tr>
            ) : (
              delinquentRows.map((row: any, idx: number) => {
                const sev = severity(row.days_past_due)
                const isSevere = row.days_past_due > 90
                return (
                  <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-[13px] text-gray-700">{row.unit_number ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{row.owner_name}</span>
                      {row.owner_email && (
                        <div className="text-xs text-gray-500">{row.owner_email}</div>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${isSevere ? 'font-semibold text-red-700' : 'text-gray-900'}`}>
                      {money(row.amount_due)}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${isSevere ? 'font-semibold text-red-700' : 'text-gray-700'}`}>
                      {row.days_past_due}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">
                      {row.last_payment_date ? date(row.last_payment_date) : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusChip tone={sev.tone}>{sev.label}</StatusChip></td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {delinquentRows.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-100 ring-1 ring-red-200" />
            Severe (&gt;90d)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-100 ring-1 ring-amber-200" />
            Warning / Moderate (31-90d)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-blue-100 ring-1 ring-blue-200" />
            Recent (&le;30d)
          </div>
        </div>
      )}
    </div>
  )
}
