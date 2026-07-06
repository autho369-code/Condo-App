import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { money } from '@/lib/utils'
import { Users, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

export default async function BoardOwnersPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []
  const today = new Date().toISOString().slice(0, 10)

  const [
    { data: occupancies },
    { data: balances },
    { data: viols },
    { data: policies },
  ] = await Promise.all([
    db.from('occupancies')
      .select('owner_id, unit_id, occupancy_type, status, owners(id, full_name, email, phone, emergency_contact_name, emergency_contact_phone), units(unit_number)')
      .in('association_id', ids)
      .eq('status', 'current'),
    db.from('unit_balances').select('unit_id, balance').in('association_id', ids),
    db.from('violations').select('owner_id, unit_id').in('association_id', ids).is('archived_at', null).not('status', 'in', '("closed","cured","violation_dismissed")'),
    db.from('insurance_policies').select('owner_id, expiration_date, status').in('association_id', ids).is('archived_at', null),
  ])

  const balanceByUnit = new Map<string, number>((balances ?? []).map((b: any) => [b.unit_id, Number(b.balance ?? 0)]))
  const violCount = new Map<string, number>()
  for (const v of viols ?? []) {
    const key = v.owner_id ?? v.unit_id
    if (key) violCount.set(key, (violCount.get(key) ?? 0) + 1)
  }
  const insuranceByOwner = new Map<string, 'current' | 'expired'>()
  for (const p of policies ?? []) {
    if (!p.owner_id) continue
    const state = p.expiration_date && p.expiration_date >= today ? 'current' : 'expired'
    // Any current policy wins over an expired one.
    if (insuranceByOwner.get(p.owner_id) !== 'current') insuranceByOwner.set(p.owner_id, state)
  }

  const rows = (occupancies ?? [])
    .filter((o: any) => o.owners)
    .map((o: any) => ({
      ownerId: o.owners.id,
      name: o.owners.full_name ?? '—',
      email: o.owners.email ?? '—',
      phone: o.owners.phone ?? '—',
      unit: o.units?.unit_number ?? '—',
      type: o.occupancy_type ?? '—',
      balance: balanceByUnit.get(o.unit_id) ?? 0,
      violations: (violCount.get(o.owners.id) ?? 0) + (violCount.get(o.unit_id) ?? 0),
      insurance: insuranceByOwner.get(o.owners.id) ?? null,
      emergency: o.owners.emergency_contact_name
        ? `${o.owners.emergency_contact_name}${o.owners.emergency_contact_phone ? ` · ${o.owners.emergency_contact_phone}` : ''}`
        : '—',
    }))
    .sort((a: any, b: any) => String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true }))

  const delinquent = rows.filter((r: any) => r.balance > 0).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Homeowner Accounts</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          View-only owner directory with balances, violations, and insurance compliance — no personal payment details are stored or shown
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          { label: 'Current Owners', value: rows.length, icon: Users, warn: false },
          { label: 'Delinquent Accounts', value: delinquent, icon: AlertTriangle, warn: delinquent > 0 },
          { label: 'Missing/Expired Insurance', value: rows.filter((r: any) => r.insurance !== 'current').length, icon: AlertTriangle, warn: false },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className={`${card} px-4 py-3.5`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{item.label}</div>
                  <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${item.warn ? 'text-red-700' : 'text-gray-950'}`}>{item.value}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Icon className="h-4.5 w-4.5 text-gray-400" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Unit</th>
                <th className="px-4 py-2.5 text-left font-medium">Owner</th>
                <th className="px-4 py-2.5 text-left font-medium">Contact</th>
                <th className="px-4 py-2.5 text-left font-medium">Type</th>
                <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                <th className="px-4 py-2.5 text-right font-medium">Violations</th>
                <th className="px-4 py-2.5 text-left font-medium">Insurance</th>
                <th className="px-4 py-2.5 text-left font-medium">Emergency Contact</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">No current owners found.</td></tr>
              ) : (
                rows.map((r: any) => (
                  <tr key={`${r.ownerId}-${r.unit}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium tabular-nums text-gray-900">{r.unit}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">
                      <div>{r.email}</div>
                      {r.phone !== '—' && <div className="text-xs text-gray-500">{r.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-[13px] capitalize text-gray-700">{String(r.type).replace(/_/g, ' ')}</td>
                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${r.balance > 0 ? 'text-red-700' : 'text-gray-700'}`}>{money(r.balance)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${r.violations > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>{r.violations}</td>
                    <td className="px-4 py-3">
                      {r.insurance === 'current'
                        ? <StatusChip tone="success">Current</StatusChip>
                        : r.insurance === 'expired'
                          ? <StatusChip tone="danger">Expired</StatusChip>
                          : <StatusChip tone="neutral">None on file</StatusChip>}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">{r.emergency}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
