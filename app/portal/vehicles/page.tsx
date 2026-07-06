import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { date, money } from '@/lib/utils'
import { Car } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

export default async function OwnerVehiclesPage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  const { data: assignments } = await db
    .from('parking_assignments')
    .select('id, status, start_date, end_date, monthly_fee, vehicle_make, vehicle_model, vehicle_color, license_plate, insurance_company, insurance_policy_number, parking_spaces(label, space_type), units(unit_number)')
    .eq('owner_id', me.owner_id)
    .order('start_date', { ascending: false })

  const rows = assignments ?? []
  const active = rows.filter((r: any) => r.status === 'active')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Vehicles & Parking</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Your registered vehicles and parking assignments — contact your management company to add or change a vehicle
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Active Assignments', value: active.length },
          { label: 'All Records', value: rows.length },
        ].map((item) => (
          <div key={item.label} className={`${card} px-4 py-3.5`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{item.label}</div>
                <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{item.value}</div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                <Car className="h-4.5 w-4.5 text-gray-400" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Vehicle</th>
                <th className="px-4 py-2.5 text-left font-medium">Plate</th>
                <th className="px-4 py-2.5 text-left font-medium">Space</th>
                <th className="px-4 py-2.5 text-left font-medium">Unit</th>
                <th className="px-4 py-2.5 text-left font-medium">Insurance</th>
                <th className="px-4 py-2.5 text-right font-medium">Monthly Fee</th>
                <th className="px-4 py-2.5 text-left font-medium">Since</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">No vehicles or parking assignments on file.</td></tr>
              ) : (
                rows.map((r: any) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {[r.vehicle_color, r.vehicle_make, r.vehicle_model].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-gray-700">{r.license_plate ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">
                      {r.parking_spaces?.label ?? '—'}
                      {r.parking_spaces?.space_type ? <span className="ml-1 text-xs capitalize text-gray-400">({String(r.parking_spaces.space_type).replace(/_/g, ' ')})</span> : null}
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-gray-700">{r.units?.unit_number ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">{r.insurance_company ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{r.monthly_fee ? money(Number(r.monthly_fee)) : '—'}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-gray-700">{date(r.start_date)}</td>
                    <td className="px-4 py-3"><StatusChip tone={r.status === 'active' ? 'success' : 'neutral'}>{r.status ?? '—'}</StatusChip></td>
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
