import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { UserCheck, Key, UserX, Eye } from 'lucide-react'
import { Alert } from '@/components/ui/shell'
import { collectLoadErrors } from '@/lib/company-admin/load-errors'

export const dynamic = 'force-dynamic'

export default async function OwnersPage({
  searchParams,
}: {
  searchParams: Promise<{ association?: string }>
}) {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const sp = await searchParams

  // Fetch associations (filter list + occupancy scope)
  const { data: associations, error: associationsError } = await db
    .from('associations')
    .select('id, name')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name')
  const assocIds = ((associations ?? []) as { id: string }[]).map((a) => a.id)

  // Fetch owners (paged past the 1,000-row cap)
  const { rows: owners, error: ownersError } = await fetchAllRows(() => db
    .from('owners')
    .select('id, full_name, email, phone, portal_activated, portal_login_last_at')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('full_name', { ascending: true, nullsFirst: false })
    .order('id'))

  // Current occupancies in this company's associations. Scoped by association
  // (a handful of ids) rather than by every owner id, which overflowed the URL.
  const { rows: occupancies, error: occupanciesError } = await fetchAllRows(() => {
    let q = db
      .from('occupancies')
      .select(`id, owner_id, unit_id, association_id, units!occupancies_unit_id_fkey(unit_number, building_id), associations!occupancies_association_id_fkey(id, name)`)
      .eq('status', 'current')
      .in('association_id', assocIds.length > 0 ? assocIds : ['00000000-0000-0000-0000-000000000000'])
      .order('id')
    if (sp.association) q = q.eq('association_id', sp.association)
    return q
  })

  const loadErrors = collectLoadErrors({
    Associations: { error: associationsError },
    Owners: { error: ownersError },
    Occupancies: { error: occupanciesError },
  })

  // Build owner → units & associations map
  const ownerMap = new Map<string, { units: string[]; associations: Map<string, string> }>()
  for (const occ of occupancies ?? []) {
    if (!ownerMap.has(occ.owner_id)) {
      ownerMap.set(occ.owner_id, { units: [], associations: new Map() })
    }
    const entry = ownerMap.get(occ.owner_id)!
    if (occ.units?.unit_number) entry.units.push(occ.units.unit_number)
    if (occ.associations?.name) entry.associations.set(occ.associations.id, occ.associations.name)
  }

  // Filter owners by association if selected
  let filteredOwners = owners ?? []
  if (sp.association) {
    filteredOwners = filteredOwners.filter((o: any) => {
      const info = ownerMap.get(o.id)
      return info?.associations.has(sp.association!)
    })
  }

  // Stats
  const totalOwners = (owners ?? []).length
  const portalActivated = (owners ?? []).filter((o: any) => o.portal_activated).length
  const neverLoggedIn = (owners ?? []).filter((o: any) => o.portal_activated && !o.portal_login_last_at).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Owners</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">Manage all property owners in your portfolio</p>
        </div>
      </div>

      {loadErrors.length > 0 && <Alert tone="danger" title="Some owner data could not be loaded; the list below may be incomplete.">{loadErrors.join(' · ')}</Alert>}

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total Owners', value: totalOwners, icon: UserCheck },
          { label: 'Portal Activated', value: portalActivated, icon: Key },
          { label: 'Never Logged In', value: neverLoggedIn, icon: UserX },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[13px] font-medium text-gray-500">{item.label}</div>
                  <div className="mt-1.5 font-display text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{item.value}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Icon className="h-4.5 w-4.5 text-gray-400" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <form action="/company-admin/owners" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <label className="text-[13px] font-medium text-gray-500">
          Association
          <select name="association" defaultValue={sp.association ?? ''} className="mt-1 block h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
            <option value="">All Associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <button type="submit" className="h-10 rounded-xl bg-gray-950 px-4 text-sm font-medium text-white transition hover:bg-gray-800">Apply</button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Name</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Email</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Phone</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Association</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Unit(s)</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Portal</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Last Login</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOwners.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500">No owners found.</td></tr>
            ) : (
              filteredOwners.map((owner: any) => {
                const info = ownerMap.get(owner.id)
                const assocNames = info ? [...info.associations.values()] : []
                const units = info?.units ?? []
                return (
                  <tr key={owner.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                    <td className="px-4 py-3.5">
                      <Link href={`/owners/${owner.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">
                        {owner.full_name ?? 'Unknown'}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700">{owner.email ?? '—'}</td>
                    <td className="px-4 py-3.5 text-sm tabular-nums text-gray-700">{owner.phone ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <div className="max-w-[180px] truncate text-[13px] text-gray-700">
                        {assocNames.length > 0 ? assocNames.join(', ') : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700">
                      {units.length > 0 ? units.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusChip tone={owner.portal_activated ? 'success' : 'neutral'}>
                        {owner.portal_activated ? 'Active' : 'Inactive'}
                      </StatusChip>
                    </td>
                    <td className="px-4 py-3.5 text-sm tabular-nums text-gray-700">{date(owner.portal_login_last_at)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/owners/${owner.id}`} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-950" title="View">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[13px] text-gray-500">
        Showing {filteredOwners.length} of {totalOwners} owners
        {sp.association && ` in selected association`}
      </div>
    </div>
  )
}
