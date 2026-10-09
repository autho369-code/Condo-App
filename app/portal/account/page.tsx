import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { money } from '@/lib/utils'
import { Alert } from '@/components/ui/shell'
import { RecordSwitcher } from '@/components/ui/record-switcher'
import { loadOwnerRecords, pickOwnerRecord } from '@/lib/portal/owner-records'

export const dynamic = 'force-dynamic'

export default async function OwnerAccountPage({ searchParams }: { searchParams: Promise<{ record?: string }> }) {
  const sp = await searchParams
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any
  // One owner record per association: show the chosen one (default: the first).
  const { records, error: recordsError } = await loadOwnerRecords(db, me)
  const recordId = pickOwnerRecord(me, sp.record)

  const [{ data: owner, error: ownerError }, { data: occs, error: occsError }] = await Promise.all([
    db.from('owners').select('full_name, first_name, last_name, email, phone, phone_numbers, address_street, address_city, address_state, address_zip, associations(name, address, city, state, zip)').eq('id', recordId).maybeSingle(),
    db.from('occupancies')
      .select('id, dues_amount, dues_paid_through, share_pct, occupancy_type, units(unit_number)')
      .eq('owner_id', recordId).eq('status', 'current')
      .order('is_primary', { ascending: false }).order('created_at', { ascending: true }).order('id', { ascending: true }),
  ])
  const o = owner ?? {}
  const units = (occs ?? []) as any[]
  // The record's own association (also when it has no current unit).
  const assocInfo: any = (owner as any)?.associations ?? null
  const loadError = ownerError?.message ?? occsError?.message ?? null

  const address = [o.address_street, o.address_city, o.address_state, o.address_zip].filter(Boolean).join(', ') || 'Not set'
  const propAddress = [assocInfo?.address, assocInfo?.city, assocInfo?.state, assocInfo?.zip].filter(Boolean).join(', ') || 'Not set'

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">My Account</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Your account details and occupancy information</p>
      </div>

      {recordsError && <Alert tone="danger">{recordsError}</Alert>}
      {loadError && <Alert tone="danger" title="Could not load your account:">{loadError}</Alert>}
      <RecordSwitcher records={records} currentId={recordId} basePath="/portal/account" caption="Each association keeps its own account details for you. Showing:" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h2 className="text-sm font-semibold text-gray-950">Personal Information</h2>
          {[
            ['Name', (o.full_name ?? `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim()) || '—'],
            ['Email', o.email ?? me.email ?? '—'],
            // phone is what the profile page saves; phone_numbers is [] for every owner.
            ['Phone', o.phone || (Array.isArray(o.phone_numbers) ? (typeof o.phone_numbers[0] === 'string' ? o.phone_numbers[0] : o.phone_numbers[0]?.number) : null) || '—'],
            ['Mailing Address', address],
          ].map(([l, v]) => (
            <div key={l as string}>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{l}</div>
              <div className="mt-0.5 text-sm text-gray-900">{v}</div>
            </div>
          ))}
        </div>

        <div className="space-y-4 rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h2 className="text-sm font-semibold text-gray-950">Property Information</h2>
          {[
            ['Association', assocInfo?.name ?? '—'],
            ['Property Address', propAddress],
          ].map(([l, v]) => (
            <div key={l as string}>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{l}</div>
              <div className="mt-0.5 text-sm text-gray-900">{v}</div>
            </div>
          ))}
          {units.length === 0 ? (
            <p className="text-sm text-gray-500">No current unit in this association.</p>
          ) : units.map((occ) => (
            <div key={occ.id} className="space-y-4 border-t border-gray-100 pt-4">
              {[
                ['Unit', occ.units?.unit_number ?? '—'],
                ['Ownership %', occ.share_pct ? `${occ.share_pct}%` : '—'],
                ['Occupancy Type', occ.occupancy_type ? occ.occupancy_type.replace('_',' ') : 'Owner'],
                ['Monthly Dues', money(occ.dues_amount ?? 0)],
                ['Dues Paid Through', occ.dues_paid_through ? new Date(occ.dues_paid_through).toLocaleDateString() : '—'],
              ].map(([l, v]) => (
                <div key={l as string}>
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{l}</div>
                  <div className="mt-0.5 text-sm text-gray-900">{v}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
