import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { Shield } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OwnerInsurancePage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  // Check for insurance data on the owner record or an insurance table
  const { data: owner } = await db.from('owners').select('id, insurance_carrier, insurance_policy_number, insurance_expiration, insurance_last_uploaded').eq('id', me.owner_id).maybeSingle()
  const o = owner ?? {}

  // Also check insurance_certificates table
  let certs: any[] = []
  try {
    const { data } = await db.from('insurance_certificates').select('*').eq('owner_id', me.owner_id).order('created_at', { ascending: false }).limit(5)
    certs = data ?? []
  } catch {}

  const hasInsurance = o.insurance_carrier || o.insurance_expiration || certs.length > 0
  const expDate = o.insurance_expiration ? new Date(o.insurance_expiration) : certs[0]?.expiration_date ? new Date(certs[0].expiration_date) : null
  const expired = expDate && expDate < new Date()
  const expiringSoon = expDate && !expired && expDate < new Date(Date.now() + 30 * 86400000)

  async function uploadInsurance(formData: FormData) {
    'use server'
    const supabase2 = await createClient()
    const me2 = await requireOwner()
    await (supabase2 as any).from('owners').update({
      insurance_carrier: formData.get('carrier') as string,
      insurance_policy_number: formData.get('policy_number') as string,
      insurance_expiration: formData.get('expiration_date') as string,
      insurance_last_uploaded: new Date().toISOString(),
    }).eq('id', me2.owner_id)
    revalidatePath('/portal/insurance')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Insurance</h1>
        <p className="text-sm text-gray-500">HO6 insurance certificate management</p>
      </div>

      {/* Status card */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${hasInsurance ? (expired ? 'bg-red-100' : expiringSoon ? 'bg-amber-100' : 'bg-emerald-100') : 'bg-gray-100'}`}>
            <Shield className={`h-6 w-6 ${hasInsurance ? (expired ? 'text-red-600' : expiringSoon ? 'text-amber-600' : 'text-emerald-600') : 'text-gray-400'}`} />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{hasInsurance ? (expired ? 'Insurance Expired' : expiringSoon ? 'Expiring Soon' : 'Insurance Current') : 'No Insurance on File'}</div>
            {expDate && <div className="text-sm text-gray-500">Expires: {expDate.toLocaleDateString()}</div>}
          </div>
        </div>
        {o.insurance_carrier && <div className="text-sm text-gray-600 mt-2"><span className="text-gray-500">Carrier:</span> {o.insurance_carrier}</div>}
        {o.insurance_policy_number && <div className="text-sm text-gray-600"><span className="text-gray-500">Policy #:</span> {o.insurance_policy_number}</div>}
      </div>

      {/* Upload form */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Upload Insurance Certificate</h2>
        <form action={uploadInsurance} className="space-y-4">
          <label className="block"><span className="text-sm font-medium text-gray-700">Insurance Carrier</span><input name="carrier" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="e.g. State Farm" /></label>
          <label className="block"><span className="text-sm font-medium text-gray-700">Policy Number</span><input name="policy_number" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></label>
          <label className="block"><span className="text-sm font-medium text-gray-700">Expiration Date</span><input type="date" name="expiration_date" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></label>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm">Upload</button>
        </form>
      </div>
    </div>
  )
}
