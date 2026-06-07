import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { money } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function OwnerAccountPage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any
  const ownerId = me.owner_id

  const { data: owner } = await db.from('owners').select('*').eq('id', ownerId).maybeSingle()
  const { data: occs } = await db.from('occupancies').select('id, unit_id, association_id, dues_amount, dues_paid_through, share_pct, occupancy_type, status').eq('owner_id', ownerId).is('archived_at', null).limit(10)
  const o = owner ?? {}
  const occ = occs?.[0] ?? {}

  // Get unit + association info
  let unitInfo: any = null
  if (occ.unit_id) {
    const { data: u } = await db.from('units').select('unit_number, building_id').eq('id', occ.unit_id).maybeSingle()
    unitInfo = u ?? {}
  }
  let assocInfo: any = null
  if (occ.association_id) {
    const { data: a } = await db.from('associations').select('name, address, city, state, zip').eq('id', occ.association_id).maybeSingle()
    assocInfo = a ?? {}
  }

  const address = [o.address_street, o.address_city, o.address_state, o.address_zip].filter(Boolean).join(', ') || 'Not set'
  const propAddress = [assocInfo?.address, assocInfo?.city, assocInfo?.state, assocInfo?.zip].filter(Boolean).join(', ') || 'Not set'

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
        <p className="text-sm text-gray-500">Your account details and occupancy information</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Personal Information</h2>
          {[
            ['Name', (o.full_name ?? `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim()) || '—'],
            ['Email', o.email ?? me.email ?? '—'],
            ['Phone', Array.isArray(o.phone_numbers) ? o.phone_numbers[0] : o.phone ?? '—'],
            ['Mailing Address', address],
          ].map(([l, v]) => (
            <div key={l as string}>
              <div className="text-xs font-medium uppercase text-gray-500">{l}</div>
              <div className="text-sm text-gray-900 mt-0.5">{v}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Property Information</h2>
          {[
            ['Association', assocInfo?.name ?? '—'],
            ['Unit', unitInfo?.unit_number ?? occ.unit_id ?? '—'],
            ['Property Address', propAddress],
            ['Ownership %', occ.share_pct ? `${occ.share_pct}%` : '—'],
            ['Occupancy Type', occ.occupancy_type ? occ.occupancy_type.replace('_',' ') : 'Owner'],
            ['Monthly Dues', money(occ.dues_amount ?? 0)],
            ['Dues Paid Through', occ.dues_paid_through ? new Date(occ.dues_paid_through).toLocaleDateString() : '—'],
          ].map(([l, v]) => (
            <div key={l as string}>
              <div className="text-xs font-medium uppercase text-gray-500">{l}</div>
              <div className="text-sm text-gray-900 mt-0.5">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
