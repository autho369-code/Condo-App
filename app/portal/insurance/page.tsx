import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { Alert } from '@/components/ui/shell'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Shield, FileText } from 'lucide-react'
import { AddInsurancePolicyForm } from '@/components/insurance/add-policy-form'
import { isScopedStoragePath } from '@/lib/security/storage-paths'
import { todayInZone } from '@/lib/time/zoned'
import { associationZone } from '../_lib/tenure'
import { RecordSwitcher } from '@/components/ui/record-switcher'
import { loadOwnerRecords, pickOwnerRecord } from '@/lib/portal/owner-records'

export const dynamic = 'force-dynamic'

// Uploaded certificates live alongside the rest of the association records.
const BUCKET = 'association-documents'

const input =
  'mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'

export default async function OwnerInsurancePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; reminders?: string; record?: string }> }) {
  const banner = await searchParams
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  // One login can hold an owner record per association, each with its own HO6
  // policy. Work on one record at a time (?record=, checked against the login).
  const { records, error: recordsError } = await loadOwnerRecords(db, me)
  const recordId = pickOwnerRecord(me, banner.record)
  const recordQuery = records.length > 1 && recordId ? `record=${encodeURIComponent(recordId)}&` : ''

  // HO6 policies on file for this owner record
  // Supabase reports failures in `error` (it does not throw), so check it: a
  // failed read must not look like "no insurance on file".
  const { data: policyRows, error: policiesError } = await db
    .from('insurance_policies')
    .select('id, insurance_company, policy_number, coverage_amount, effective_date, expiration_date, certificate_file_url, remind_owner, remind_manager, status, created_at')
    .eq('owner_id', recordId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(5)
  const policies: any[] = policyRows ?? []

  const current = policies[0] ?? null
  const hasInsurance = policies.length > 0
  // Date-only compare: coverage ending today is still in force today.
  const expYmd = current?.expiration_date ? String(current.expiration_date).slice(0, 10) : null
  // "Today" in the owner's community zone — the server runs in UTC.
  const { data: zoneOcc } = await db
    .from('occupancies')
    .select('associations(timezone)')
    .eq('owner_id', recordId)
    .eq('status', 'current')
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle()
  const todayYmd = todayInZone(associationZone(zoneOcc?.associations?.timezone))
  const soonDate = new Date(`${todayYmd}T00:00:00Z`)
  soonDate.setUTCDate(soonDate.getUTCDate() + 30)
  const soonYmd = soonDate.toISOString().slice(0, 10)
  const expired = !!(expYmd && expYmd < todayYmd)
  const expiringSoon = !!(expYmd && !expired && expYmd < soonYmd)

  // Signed link to the uploaded certificate (private bucket)
  let certificateUrl: string | null = null
  if (current?.certificate_file_url) {
    if (/^https?:\/\//i.test(current.certificate_file_url)) {
      certificateUrl = current.certificate_file_url
    } else if (recordId && isScopedStoragePath(current.certificate_file_url, 'insurance', recordId)) {
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
    const back = String(formData.get('return_query') ?? '')
    const backQuery = /^record=[0-9a-f-]{36}&$/i.test(back) ? back : ''
    if (!policyId) redirect(`/portal/insurance?${backQuery}error=` + encodeURIComponent('Missing policy.'))
    const { data: changed, error } = await (supabase2 as any)
      .from('insurance_policies')
      .update({
        remind_owner: formData.get('remind_owner') === 'on',
        remind_manager: formData.get('remind_manager') === 'on',
      })
      .eq('id', policyId)
      // A policy of one of this login's owner records.
      .in('owner_id', me2.owner_ids)
      .select('id')
    if (error) redirect(`/portal/insurance?${backQuery}error=` + encodeURIComponent(error.message))
    if (!changed?.length) redirect(`/portal/insurance?${backQuery}error=` + encodeURIComponent('Reminders were not saved: this policy was removed or is no longer linked to your account. Please contact your management company.'))
    revalidatePath('/portal/insurance')
    redirect(`/portal/insurance?${backQuery}reminders=1`)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Insurance</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">HO6 insurance certificate management</p>
      </div>

      <RecordSwitcher records={records} currentId={recordId} basePath="/portal/insurance" caption="Each association keeps its own insurance on file. Showing:" />
      {recordsError && <Alert tone="danger" title="Could not load your associations:">{recordsError}</Alert>}
      {banner.error && <Alert tone="danger" title="Could not save:">{banner.error}</Alert>}
      {policiesError && (
        <Alert tone="danger" title="Could not load your insurance policies:">
          {policiesError.message}. Your policy may already be on file — please refresh before adding it again.
        </Alert>
      )}
      {banner.saved === '1' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Insurance policy saved to your association records.</div>
      )}
      {banner.reminders === '1' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Reminder preferences updated.</div>
      )}

      {/* Status card */}
      <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${hasInsurance ? (expired ? 'bg-red-100' : expiringSoon ? 'bg-amber-100' : 'bg-emerald-100') : 'bg-gray-100'}`}>
            <Shield className={`h-6 w-6 ${hasInsurance ? (expired ? 'text-red-600' : expiringSoon ? 'text-amber-600' : 'text-emerald-600') : 'text-gray-400'}`} />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{hasInsurance ? (expired ? 'Insurance Expired' : expiringSoon ? 'Expiring Soon' : 'Insurance Current') : policiesError ? 'Insurance Status Unavailable' : 'No Insurance on File'}</div>
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
        <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Expiration Reminders</h2>
          <p className="mt-1 mb-4 text-sm text-gray-500">Email notices are sent 30 days and 15 days before the policy expires.</p>
          <form action={updateReminders} className="space-y-3">
            <input type="hidden" name="policy_id" value={current.id} />
            <input type="hidden" name="return_query" value={recordQuery} />
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
        <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-950">Previous Policies</h2>
          <ul className="divide-y divide-line">
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
      <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
        <h2 className="mb-1 text-sm font-semibold text-gray-950">Add Insurance Policy</h2>
        <p className="mb-4 text-sm text-gray-500">Upload your policy document — it is saved to your association records.</p>
        <AddInsurancePolicyForm ownerId={recordId} returnQuery={recordQuery} />
      </div>
    </div>
  )
}
