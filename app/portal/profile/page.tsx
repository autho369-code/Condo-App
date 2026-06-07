import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

export default async function OwnerProfilePage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  const { data: owner } = await db.from('owners').select('*').eq('id', me.owner_id).maybeSingle()
  const o = owner ?? {}

  async function saveProfile(formData: FormData) {
    'use server'
    const supabase2 = await createClient()
    const me2 = await requireOwner()
    await (supabase2 as any).from('owners').update({
      phone: formData.get('phone') as string || null,
      emails: formData.get('email') ? [formData.get('email') as string] : null,
      address_street: formData.get('address_street') as string || null,
      address_city: formData.get('address_city') as string || null,
      address_state: formData.get('address_state') as string || null,
      address_zip: formData.get('address_zip') as string || null,
    }).eq('id', me2.owner_id)
    revalidatePath('/portal/profile')
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-500">Update your contact information</p>
      </div>

      <form action={saveProfile} className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 mb-2">
          Name and unit assignment are managed by your association. Contact management for changes.
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-medium text-gray-700">Full Name</span><input disabled value={o.full_name ?? `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim()} className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 outline-none" /></label>
          <label className="block"><span className="text-sm font-medium text-gray-700">Email</span><input name="email" defaultValue={o.email ?? me.email ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></label>
        </div>
        <label className="block"><span className="text-sm font-medium text-gray-700">Phone</span><input name="phone" defaultValue={o.phone ?? (Array.isArray(o.phone_numbers) ? o.phone_numbers[0] : '')} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="text-sm font-medium text-gray-700">Mailing Address</span><input name="address_street" defaultValue={o.address_street ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Street" /></label>
          <label className="block"><input name="address_city" defaultValue={o.address_city ?? ''} className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="City" /></label>
          <label className="block"><input name="address_state" defaultValue={o.address_state ?? ''} className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="State" /></label>
          <label className="block"><input name="address_zip" defaultValue={o.address_zip ?? ''} className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="ZIP" /></label>
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm">Save Changes</button>
      </form>
    </div>
  )
}
