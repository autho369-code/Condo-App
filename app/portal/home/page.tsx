import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { Home, Car, PawPrint } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value ?? '—'}</dd>
    </div>
  )
}

export default async function MyHomePage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any
  const ownerId = me.owner_id

  const [{ data: occupancies }, { data: owner }] = await Promise.all([
    db.from('occupancies')
      .select('id, unit_id, occupancy_type, status, move_in_date, dues_amount, dues_frequency, units(id, unit_number, sqft, bedrooms, bathrooms, storage_number, parking_spaces, home_warranty_company, home_warranty_expires), associations(name)')
      .eq('owner_id', ownerId)
      .eq('status', 'current'),
    db.from('owners').select('emergency_contact_name, emergency_contact_phone').eq('id', ownerId).maybeSingle(),
  ])

  const occs = occupancies ?? []
  const unitIds = occs.map((o: any) => o.unit_id).filter(Boolean)

  const [{ data: parking }, { data: pets }] = await Promise.all([
    unitIds.length > 0
      ? db.from('parking_assignments')
          .select('id, vehicle_make, vehicle_model, vehicle_color, license_plate, status, parking_spaces(label, space_type)')
          .in('unit_id', unitIds)
          .eq('status', 'active')
      : Promise.resolve({ data: [] as any[] }),
    unitIds.length > 0
      ? db.from('unit_pets').select('id, pet_type, name, breed').in('unit_id', unitIds).is('archived_at', null)
      : Promise.resolve({ data: [] as any[] }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">My Home</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Your unit, parking, storage, and household details on file</p>
      </div>

      {occs.length === 0 ? (
        <div className={`${card} py-10 text-center text-sm text-gray-500`}>No current unit is linked to your account — contact your management company.</div>
      ) : (
        occs.map((o: any) => (
          <div key={o.id} className={card}>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                <Home className="h-4.5 w-4.5 text-gray-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-950">Unit {o.units?.unit_number ?? '—'}</h2>
                <p className="text-xs text-gray-500">{o.associations?.name ?? ''}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Occupancy" value={<span className="capitalize">{(o.occupancy_type ?? '—').replace(/_/g, ' ')}</span>} />
              <Field label="Move-in Date" value={o.move_in_date ? date(o.move_in_date) : '—'} />
              <Field label="Square Feet" value={o.units?.sqft ? Number(o.units.sqft).toLocaleString() : '—'} />
              <Field label="Bedrooms / Baths" value={o.units?.bedrooms || o.units?.bathrooms ? `${o.units?.bedrooms ?? '—'} / ${o.units?.bathrooms ?? '—'}` : '—'} />
              <Field label="Storage" value={o.units?.storage_number ?? '—'} />
              <Field label="Parking Spaces (deeded)" value={o.units?.parking_spaces ?? '—'} />
              <Field label="Dues" value={o.dues_amount ? `$${Number(o.dues_amount).toLocaleString()} ${o.dues_frequency ?? 'monthly'}` : '—'} />
              <Field label="Home Warranty" value={o.units?.home_warranty_company ? `${o.units.home_warranty_company}${o.units.home_warranty_expires ? ` (to ${date(o.units.home_warranty_expires)})` : ''}` : '—'} />
            </dl>
          </div>
        ))
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={card}>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
              <Car className="h-4.5 w-4.5 text-gray-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-950">Assigned Parking</h2>
          </div>
          {(parking ?? []).length === 0 ? (
            <p className="py-2 text-sm text-gray-400">No parking assignments on file. Contact your management company to register a vehicle.</p>
          ) : (
            <div className="space-y-2">
              {(parking ?? []).map((p: any) => (
                <div key={p.id} className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">
                    Space {p.parking_spaces?.label ?? '—'}
                    {p.parking_spaces?.space_type ? <span className="ml-1.5 text-xs font-normal capitalize text-gray-500">({String(p.parking_spaces.space_type).replace(/_/g, ' ')})</span> : null}
                  </div>
                  {(p.vehicle_make || p.license_plate) && (
                    <div className="mt-0.5 text-xs text-gray-500">
                      {[p.vehicle_color, p.vehicle_make, p.vehicle_model].filter(Boolean).join(' ')}{p.license_plate ? ` · ${p.license_plate}` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={card}>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
              <PawPrint className="h-4.5 w-4.5 text-gray-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-950">Registered Pets</h2>
          </div>
          {(pets ?? []).length === 0 ? (
            <p className="py-2 text-sm text-gray-400">No pets registered. Contact your management company to register one.</p>
          ) : (
            <div className="space-y-2">
              {(pets ?? []).map((p: any) => (
                <div key={p.id} className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{p.name ?? 'Pet'}</div>
                  <div className="mt-0.5 text-xs capitalize text-gray-500">{[p.pet_type, p.breed].filter(Boolean).join(' · ')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={card}>
        <h2 className="mb-4 text-sm font-semibold text-gray-950">Emergency Contact on File</h2>
        {owner?.emergency_contact_name ? (
          <p className="text-sm text-gray-900">
            {owner.emergency_contact_name}
            {owner.emergency_contact_phone ? <span className="text-gray-500"> · {owner.emergency_contact_phone}</span> : null}
          </p>
        ) : (
          <p className="text-sm text-gray-400">No emergency contact on file — update it under Profile.</p>
        )}
      </div>
    </div>
  )
}
