import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

type UnitOption = {
  unit_id: string | null
  unit_number: string | null
  association_id: string | null
}

/**
 * Owners cannot INSERT into `violations` (RLS — only staff create formal
 * violations). Instead, an owner reports a concern as a `service_requests` row
 * with source='resident' — the same proven, manager-visible flow used by
 * submitServiceRequest. The description is clearly tagged as a resident-reported
 * concern/violation so a manager can triage it into a formal violation.
 */
async function reportConcern(formData: FormData) {
  'use server'
  const failTo = (msg: string) =>
    redirect('/portal/violations/report?error=' + encodeURIComponent(msg))

  const me = await requireOwner()
  if (!me.owner_id) { failTo('Only owners can report a concern'); return }

  const unitId = (formData.get('unit_id') as string) || ''
  const title = (formData.get('title') as string)?.trim()
  const details = (formData.get('description') as string)?.trim()

  if (!unitId) { failTo('Please choose a unit'); return }
  if (!title) { failTo('Please give your concern a short title'); return }
  if (!details || details.length < 10) {
    failTo('Please describe the concern in at least a sentence'); return
  }

  const supabase = await createClient()

  // Resolve association + portfolio from the unit — never trust the client.
  const { data: unit, error: unitErr } = await (supabase as any)
    .from('units')
    .select('id, buildings!inner(association_id, associations!inner(portfolio_id))')
    .eq('id', unitId)
    .maybeSingle()
  if (unitErr || !unit) { failTo('Unit not found or you no longer have access to it'); return }
  const associationId = (unit.buildings as any).association_id
  const portfolioId = (unit.buildings as any).associations.portfolio_id

  const description =
    `RESIDENT-REPORTED CONCERN / RULE VIOLATION\n` +
    `Title: ${title}\n\n` +
    `${details}\n\n` +
    `(Submitted by a homeowner via the owner portal for manager triage into a ` +
    `formal violation if warranted.)`

  const { data: sr, error } = await (supabase as any)
    .from('service_requests')
    .insert({
      portfolio_id: portfolioId,
      association_id: associationId,
      unit_id: unitId,
      homeowner_id: me.owner_id,
      owner_id: me.owner_id,
      description,
      priority: 'normal',
      source: 'resident',
      status: 'open',
      created_by: me.auth_user_id,
    })
    .select('id')
    .single()

  if (error || !sr) { failTo(error?.message ?? 'Failed to submit your concern'); return }

  revalidatePath('/portal/violations')
  redirect('/portal/violations?reported=1')
}

export default async function ReportConcernPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  await requireOwner()
  const supabase = await createClient()

  // The owner's units (RLS scopes this view to units they belong to).
  const { data: units } = await (supabase as any)
    .from('v_unit_account_summary')
    .select('unit_id, unit_number, association_id')
  const unitOptions = (units ?? []) as UnitOption[]

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <Link href="/portal/violations" className="hover:text-gray-950 hover:underline">← Back to violations</Link>
      </div>

      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Report a concern</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          See a possible rule violation or a community concern? Send it to your property
          manager. They&apos;ll review it and open a formal violation if needed.
        </p>
      </div>

      {sp.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="font-semibold">Could not submit:</span> {sp.error}
        </div>
      )}

      {unitOptions.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-6 text-sm text-gray-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          You don&apos;t have a unit on file yet. Contact your property manager so they can link
          your account to your unit.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <form action={reportConcern} className="space-y-5">
            <div>
              <span className="text-sm font-medium text-gray-700">Unit</span>
              {unitOptions.length === 1 ? (
                <>
                  <input type="hidden" name="unit_id" value={unitOptions[0].unit_id ?? ''} />
                  <div className="mt-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800">
                    Unit {unitOptions[0].unit_number ?? '—'}
                  </div>
                </>
              ) : (
                <select
                  name="unit_id"
                  required
                  className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                >
                  <option value="">Choose a unit…</option>
                  {unitOptions.map((u) => (
                    <option key={u.unit_id} value={u.unit_id ?? ''}>Unit {u.unit_number ?? '—'}</option>
                  ))}
                </select>
              )}
            </div>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Title</span>
              <input
                name="title"
                required
                placeholder="e.g. Unleashed dog in courtyard"
                className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">What happened?</span>
              <textarea
                name="description"
                required
                minLength={10}
                rows={5}
                placeholder="Describe the concern — what, where, and when. Be specific so your manager can follow up."
                className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              />
            </label>

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <Link href="/portal/violations" className="text-sm text-gray-600 hover:underline">Cancel</Link>
              <button type="submit" className="rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800">Submit concern</button>
            </div>
          </form>
        </div>
      )}

      <p className="text-xs text-gray-400">
        This goes to your management team for review — it is not a formal violation notice.
        For an active emergency or safety threat, call your emergency line.
      </p>
    </div>
  )
}
