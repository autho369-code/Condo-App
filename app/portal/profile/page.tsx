import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function OwnerProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const banner = await searchParams
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  const { data: owner } = await db.from('owners').select('*').eq('id', me.owner_id).maybeSingle()
  const o = owner ?? {}

  async function saveProfile(formData: FormData) {
    'use server'
    const supabase2 = await createClient()
    const me2 = await requireOwner()
    const { error } = await (supabase2 as any).from('owners').update({
      phone: formData.get('phone') as string || null,
      email: formData.get('email') as string || null,
      address_street: formData.get('address_street') as string || null,
      address_city: formData.get('address_city') as string || null,
      address_state: formData.get('address_state') as string || null,
      address_zip: formData.get('address_zip') as string || null,
    }).eq('id', me2.owner_id)
    if (error) redirect('/portal/profile?error=' + encodeURIComponent(error.message))
    revalidatePath('/portal/profile')
    redirect('/portal/profile?saved=1')
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Profile</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Update your contact information</p>
      </div>

      {banner.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{banner.error}</div>
      )}
      {banner.saved === '1' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Your profile was saved.</div>
      )}

      <form action={saveProfile} className="space-y-4 rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mb-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-500">
          Name and unit assignment are managed by your association. Contact management for changes.
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-medium text-gray-700">Full Name</span><input disabled value={o.full_name ?? `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim()} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 outline-none" /></label>
          <label className="block"><span className="text-sm font-medium text-gray-700">Email</span><input name="email" defaultValue={o.email ?? me.email ?? ''} className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" /></label>
        </div>
        <label className="block"><span className="text-sm font-medium text-gray-700">Phone</span><input name="phone" defaultValue={o.phone ?? (Array.isArray(o.phone_numbers) ? o.phone_numbers[0] : '')} className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" /></label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="text-sm font-medium text-gray-700">Mailing Address</span><input name="address_street" defaultValue={o.address_street ?? ''} className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" placeholder="Street" /></label>
          <label className="block"><input name="address_city" defaultValue={o.address_city ?? ''} className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" placeholder="City" /></label>
          <label className="block"><input name="address_state" defaultValue={o.address_state ?? ''} className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" placeholder="State" /></label>
          <label className="block"><input name="address_zip" defaultValue={o.address_zip ?? ''} className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" placeholder="ZIP" /></label>
        </div>
        <button type="submit" className="rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800">Save Changes</button>
      </form>
    </div>
  )
}
