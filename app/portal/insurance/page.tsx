import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Shield } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OwnerInsurancePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const banner = await searchParams
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
    const { error } = await (supabase2 as any).from('insurance_policies').insert({
      owner_id: me2.owner_id,
      insurance_company: (formData.get('carrier') as string) || null,
      policy_number: (formData.get('policy_number') as string) || null,
      expiration_date: (formData.get('expiration_date') as string) || null,
      status: 'active',
    })
    if (error) redirect('/portal/insurance?error=' + encodeURIComponent(error.message))
    revalidatePath('/portal/insurance')
    redirect('/portal/insurance?saved=1')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Insurance</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">HO6 insurance certificate management</p>
      </div>

      {banner.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{banner.error}</div>
      )}
      {banner.saved === '1' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Insurance policy saved.</div>
      )}

      {/* Status card */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
        <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h2 className="mb-3 text-sm font-semibold text-gray-950">Previous Policies</h2>
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
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="mb-4 text-sm font-semibold text-gray-950">Add Insurance Policy</h2>
        <form action={uploadInsurance} className="space-y-4">
          <label className="block"><span className="text-sm font-medium text-gray-700">Insurance Carrier</span><input name="carrier" className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" placeholder="e.g. State Farm" /></label>
          <label className="block"><span className="text-sm font-medium text-gray-700">Policy Number</span><input name="policy_number" className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" /></label>
          <label className="block"><span className="text-sm font-medium text-gray-700">Expiration Date</span><input type="date" name="expiration_date" className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" /></label>
          <button type="submit" className="rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800">Save Policy</button>
        </form>
      </div>
    </div>
  )
}
