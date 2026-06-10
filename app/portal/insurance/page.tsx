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

  // HO6 policies on file for this owner
  let policies: any[] = []
  try {
    const { data } = await db
      .from('insurance_policies')
      .select('id, insurance_company, policy_number, coverage_amount, effective_date, expiration_date, status, created_at')
      .eq('owner_id', me.owner_id)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(5)
    policies = data ?? []
  } catch {}

  const current = policies[0] ?? null
  const hasInsurance = policies.length > 0
  const expDate = current?.expiration_date ? new Date(current.expiration_date) : null
  const expired = !!(expDate && expDate < new Date())
  const expiringSoon = !!(expDate && !expired && expDate < new Date(Date.now() + 30 * 86400000))

  async function uploadInsurance(formData: FormData) {
    'use server'
    const supabase2 = await createClient()
    const me2 = await requireOwner()
    await (supabase2 as any).from('insurance_policies').insert({
      owner_id: me2.owner_id,
      insurance_company: (formData.get('carrier') as string) || null,
      policy_number: (formData.get('policy_number') as string) || null,
      expiration_date: (formData.get('expiration_date') as string) || null,
      status: 'active',
    })
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
        {current?.insurance_company && <div className="text-sm text-gray-600 mt-2"><span className="text-gray-500">Carrier:</span> {current.insurance_company}</div>}
        {current?.policy_number && <div className="text-sm text-gray-600"><span className="text-gray-500">Policy #:</span> {current.policy_number}</div>}
      </div>

      {/* Policy history */}
      {policies.length > 1 && (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Previous Policies</h2>
          <ul className="divide-y divide-gray-100">
            {policies.slice(1).map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                <span className="text-gray-700">{p.insurance_company ?? 'Policy'}{p.policy_number ? ` · #${p.policy_number}` : ''}</span>
                <span className="text-gray-500">{p.expiration_date ? `exp. ${date(p.expiration_date)}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload form */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Add Insurance Policy</h2>
        <form action={uploadInsurance} className="space-y-4">
          <label className="block"><span className="text-sm font-medium text-gray-700">Insurance Carrier</span><input name="carrier" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="e.g. State Farm" /></label>
          <label className="block"><span className="text-sm font-medium text-gray-700">Policy Number</span><input name="policy_number" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></label>
          <label className="block"><span className="text-sm font-medium text-gray-700">Expiration Date</span><input type="date" name="expiration_date" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" /></label>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm">Save Policy</button>
        </form>
      </div>
    </div>
  )
}
