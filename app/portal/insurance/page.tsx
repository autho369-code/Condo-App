import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Shield, FileText } from 'lucide-react'
import { AddInsurancePolicyForm } from '@/components/insurance/add-policy-form'

export const dynamic = 'force-dynamic'

// Uploaded certificates live alongside the rest of the association records.
const BUCKET = 'association-documents'

const input =
  'mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'

export default async function OwnerInsurancePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; reminders?: string }> }) {
  const banner = await searchParams
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  // HO6 policies on file for this owner
  let policies: any[] = []
  try {
    const { data } = await db
      .from('insurance_policies')
      .select('id, insurance_company, policy_number, coverage_amount, effective_date, expiration_date, certificate_file_url, remind_owner, remind_manager, status, created_at')
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

  // Signed link to the uploaded certificate (private bucket)
  let certificateUrl: string | null = null
  if (current?.certificate_file_url) {
    if (/^https?:\/\//i.test(current.certificate_file_url)) {
      certificateUrl = current.certificate_file_url
    } else {
      try {
        const svc = createServiceClient() as any
        const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(current.certificate_file_url, 3600)
        certificateUrl = signed?.signedUrl ?? null
      } catch {}
    }
  }

  async function updateReminders(formData: FormData) {
    'use server'
    const me2 = await requireOwner()
    const supabase2 = await createClient()
    const policyId = formData.get('policy_id') as string
    if (!policyId) redirect('/portal/insurance?error=' + encodeURIComponent('Missing policy.'))
    const { error } = await (supabase2 as any)
      .from('insurance_policies')
      .update({
        remind_owner: formData.get('remind_owner') === 'on',
        remind_manager: formData.get('remind_manager') === 'on',
      })
      .eq('id', policyId)
      .eq('owner_id', me2.owner_id)
    if (error) redirect('/portal/insurance?error=' + encodeURIComponent(error.message))
    revalidatePath('/portal/insurance')
    redirect('/portal/insurance?reminders=1')
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
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Insurance policy saved to your association records.</div>
      )}
      {banner.reminders === '1' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Reminder preferences updated.</div>
      )}

      {/* Status card */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${hasInsurance ? (expired ? 'bg-red-100' : expiringSoon ? 'bg-amber-100' : 'bg-emerald-100') : 'bg-gray-100'}`}>
            <Shield className={`h-6 w-6 ${hasInsurance ? (expired ? 'text-red-600' : expiringSoon ? 'text-amber-600' : 'text-emerald-600') : 'text-gray-400'}`} />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{hasInsurance ? (expired ? 'Insurance Expired' : expiringSoon ? 'Expiring Soon' : 'Insurance Current') : 'No Insurance on File'}</div>
            {current && (
              <div className="text-sm text-gray-500">
                Policy period: {current.effective_date ? date(current.effective_date) : '—'} — {current.expiration_date ? date(current.expiration_date) : '—'}
              </div>
            )}
          </div>
        </div>
        {current?.insurance_company && <div className="text-sm text-gray-600 mt-2"><span className="text-gray-500">Carrier:</span> {current.insurance_company}</div>}
        {current?.policy_number && <div className="text-sm text-gray-600"><span className="text-gray-500">Policy #:</span> {current.policy_number}</div>}
        {current?.coverage_amount && <div className="text-sm text-gray-600"><span className="text-gray-500">Coverage:</span> ${Number(current.coverage_amount).toLocaleString()}</div>}
        {certificateUrl && (
          <a href={certificateUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-950 hover:underline">
            <FileText className="h-4 w-4 text-gray-400" /> View policy document
          </a>
        )}
      </div>

      {/* Reminder preferences for the current policy */}
      {current && (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h2 className="text-sm font-semibold text-gray-950">Expiration Reminders</h2>
          <p className="mt-1 mb-4 text-sm text-gray-500">Email notices are sent 30 days and 15 days before the policy expires.</p>
          <form action={updateReminders} className="space-y-3">
            <input type="hidden" name="policy_id" value={current.id} />
            <label className="flex items-center gap-2.5 text-sm text-gray-700">
              <input type="checkbox" name="remind_owner" defaultChecked={current.remind_owner !== false} className="h-4 w-4 rounded border-gray-300 text-gray-950 focus:ring-blue-500/30" />
              Email me before this policy expires
            </label>
            <label className="flex items-center gap-2.5 text-sm text-gray-700">
              <input type="checkbox" name="remind_manager" defaultChecked={current.remind_manager !== false} className="h-4 w-4 rounded border-gray-300 text-gray-950 focus:ring-blue-500/30" />
              Also notify my property manager
            </label>
            <button type="submit" className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50">Save Reminder Settings</button>
          </form>
        </div>
      )}

      {/* Policy history */}
      {policies.length > 1 && (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h2 className="mb-3 text-sm font-semibold text-gray-950">Previous Policies</h2>
          <ul className="divide-y divide-gray-100">
            {policies.slice(1).map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                <span className="text-gray-700">{p.insurance_company ?? 'Policy'}{p.policy_number ? ` · #${p.policy_number}` : ''}</span>
                <span className="text-gray-500">{p.effective_date ? date(p.effective_date) : ''}{p.expiration_date ? ` — ${date(p.expiration_date)}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add policy form — certificate uploads browser→storage (large PDFs OK) */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="mb-1 text-sm font-semibold text-gray-950">Add Insurance Policy</h2>
        <p className="mb-4 text-sm text-gray-500">Upload your policy document — it is saved to your association records.</p>
        <AddInsurancePolicyForm />
      </div>
    </div>
  )
}
