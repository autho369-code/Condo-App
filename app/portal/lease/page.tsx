import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Key } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OwnerLeasePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const banner = await searchParams
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  // Check if any occupancy is a rental. Join units for the human-readable unit number.
  const { data: occs } = await db.from('occupancies').select('id, unit_id, occupancy_type, status, move_in_date, move_out_date, units(unit_number)').eq('owner_id', me.owner_id).limit(5)
  const rentals = (occs ?? []).filter((o: any) => o.occupancy_type === 'tenant' || o.occupancy_type === 'renter')
  const hasRental = rentals.length > 0

  async function updateLease(formData: FormData) {
    'use server'
    const supabase2 = await createClient()
    const me2 = await requireOwner()
    const occId = formData.get('occupancy_id') as string
    const { error } = await (supabase2 as any).from('occupancies').update({
      move_in_date: formData.get('start_date') as string,
      move_out_date: formData.get('end_date') as string || null,
    }).eq('id', occId).eq('owner_id', me2.owner_id)
    if (error) redirect('/portal/lease?error=' + encodeURIComponent(error.message))
    revalidatePath('/portal/lease')
    redirect('/portal/lease?saved=1')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Lease Information</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Manage tenant and lease details for your unit</p>
      </div>

      {banner.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{banner.error}</div>
      )}
      {banner.saved === '1' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Lease dates updated.</div>
      )}

      {!hasRental && (occs ?? []).length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <Key className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-semibold text-gray-900">No rental units found on your account.</p>
          <p className="mt-1 text-sm text-gray-500">If you are renting your unit, contact management to set up lease tracking.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rentals.map((r: any) => (
            <div key={r.id} className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Unit {r.units?.unit_number ?? '—'}</div>
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
                  <label className="block"><span className="text-xs font-medium text-gray-600">Lease Start</span><input type="date" name="start_date" defaultValue={r.move_in_date?.split('T')[0] ?? ''} className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" /></label>
                  <label className="block"><span className="text-xs font-medium text-gray-600">Lease End</span><input type="date" name="end_date" defaultValue={r.move_out_date?.split('T')[0] ?? ''} className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" /></label>
                </div>
                <button type="submit" className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800">Update Lease Dates</button>
              </form>
            </div>
          ))}
        </div>
      )}

      {(occs ?? []).filter((o: any) => o.occupancy_type !== 'tenant' && o.occupancy_type !== 'renter').map((o: any) => (
        <div key={o.id} className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <Key className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-semibold text-gray-900">Unit {o.units?.unit_number ?? '—'} is owner-occupied.</p>
          <p className="mt-1 text-sm text-gray-500">Lease management is only available for rented units.</p>
        </div>
      ))}
    </div>
  )
}
