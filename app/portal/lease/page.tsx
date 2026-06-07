import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { Key } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OwnerLeasePage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  // Check if any occupancy is a rental
  const { data: occs } = await db.from('occupancies').select('id, unit_id, occupancy_type, status, move_in_date, move_out_date').eq('owner_id', me.owner_id).is('archived_at', null).limit(5)
  const rentals = (occs ?? []).filter((o: any) => o.occupancy_type === 'tenant' || o.occupancy_type === 'renter')
  const hasRental = rentals.length > 0

  async function updateLease(formData: FormData) {
    'use server'
    const supabase2 = await createClient()
    const me2 = await requireOwner()
    const occId = formData.get('occupancy_id') as string
    await (supabase2 as any).from('occupancies').update({
      move_in_date: formData.get('start_date') as string,
      move_out_date: formData.get('end_date') as string || null,
    }).eq('id', occId).eq('owner_id', me2.owner_id)
    revalidatePath('/portal/lease')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lease Information</h1>
        <p className="text-sm text-gray-500">Manage tenant and lease details for your unit</p>
      </div>

      {!hasRental && (occs ?? []).length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-12 text-center">
          <Key className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No rental units found on your account.</p>
          <p className="text-sm text-gray-400 mt-1">If you are renting your unit, contact management to set up lease tracking.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rentals.map((r: any) => (
            <div key={r.id} className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                  <Key className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Unit {r.unit_id}</div>
                  <div className="text-sm text-gray-500 capitalize">{r.occupancy_type?.replace('_',' ')} — {r.status?.replace('_',' ')}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Move In:</span> <span className="text-gray-900">{r.move_in_date ? date(r.move_in_date) : '—'}</span></div>
                <div><span className="text-gray-500">Move Out:</span> <span className="text-gray-900">{r.move_out_date ? date(r.move_out_date) : '—'}</span></div>
              </div>
              <form action={updateLease} className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <input type="hidden" name="occupancy_id" value={r.id} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="block"><span className="text-xs font-medium text-gray-600">Lease Start</span><input type="date" name="start_date" defaultValue={r.move_in_date?.split('T')[0] ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></label>
                  <label className="block"><span className="text-xs font-medium text-gray-600">Lease End</span><input type="date" name="end_date" defaultValue={r.move_out_date?.split('T')[0] ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></label>
                </div>
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm">Update Lease Dates</button>
              </form>
            </div>
          ))}
        </div>
      )}

      {(occs ?? []).filter((o: any) => o.occupancy_type !== 'tenant' && o.occupancy_type !== 'renter').map((o: any) => (
        <div key={o.id} className="rounded-xl bg-white border border-gray-200 shadow-sm p-12 text-center">
          <Key className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Unit {o.unit_id} is owner-occupied.</p>
          <p className="text-sm text-gray-400 mt-1">Lease management is only available for rented units.</p>
        </div>
      ))}
    </div>
  )
}
