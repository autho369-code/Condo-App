import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { UserCheck, Key, UserX, Eye } from 'lucide-react'

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

  // Fetch owners
  const { data: owners } = await db
    .from('owners')
    .select('id, full_name, email, phone, portal_activated, portal_login_last_at')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('full_name', { ascending: true, nullsFirst: false })

  const ownerIds = (owners ?? []).map((o: any) => o.id)

  // Fetch occupancies with unit + association joins for these owners
  let occQuery = db
    .from('occupancies')
    .select(`id, owner_id, unit_id, association_id, units!occupancies_unit_id_fkey(unit_number, building_id), associations!occupancies_association_id_fkey(id, name)`)
    .in('owner_id', ownerIds.length > 0 ? ownerIds : ['none'])

  if (sp.association) {
    occQuery = occQuery.eq('association_id', sp.association)
  }

  const { data: occupancies } = await occQuery

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

  // Fetch associations for filter
  const { data: associations } = await db
    .from('associations')
    .select('id, name')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name')

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
          <h1 className="text-2xl font-bold text-white">Owners</h1>
          <p className="mt-1 text-sm text-slate-400">Manage all property owners in your portfolio</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total Owners', value: totalOwners, icon: UserCheck, accent: 'emerald' },
          { label: 'Portal Activated', value: portalActivated, icon: Key, accent: 'blue' },
          { label: 'Never Logged In', value: neverLoggedIn, icon: UserX, accent: neverLoggedIn > 0 ? 'amber' : 'emerald' },
        ].map((item) => {
          const accents: Record<string, string> = {
            emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          }
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500">{item.label}</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-white">{item.value}</div>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accents[item.accent]}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <form action="/company-admin/owners" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
        <label className="text-xs font-medium uppercase text-slate-500">
          Association
          <select name="association" defaultValue={sp.association ?? ''} className="mt-1 block h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="">All Associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">Apply</button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Association</th>
              <th className="px-4 py-3 text-left font-medium">Unit(s)</th>
              <th className="px-4 py-3 text-left font-medium">Portal</th>
              <th className="px-4 py-3 text-left font-medium">Last Login</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {filteredOwners.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No owners found.</td></tr>
            ) : (
              filteredOwners.map((owner: any) => {
                const info = ownerMap.get(owner.id)
                const assocNames = info ? [...info.associations.values()] : []
                const units = info?.units ?? []
                return (
                  <tr key={owner.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Link href={`/owners/${owner.id}`} className="font-medium text-slate-200 hover:text-emerald-400">
                        {owner.full_name ?? 'Unknown'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{owner.email ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{owner.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="max-w-[180px] truncate text-slate-400">
                        {assocNames.length > 0 ? assocNames.join(', ') : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {units.length > 0 ? units.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {owner.portal_activated ? (
                        <span className="inline-flex h-6 items-center rounded-full bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">Active</span>
                      ) : (
                        <span className="inline-flex h-6 items-center rounded-full bg-slate-500/10 px-2.5 text-xs font-medium text-slate-400 ring-1 ring-slate-500/20">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{date(owner.portal_login_last_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/owners/${owner.id}`} className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300" title="View">
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

      <div className="text-xs text-slate-600">
        Showing {filteredOwners.length} of {totalOwners} owners
        {sp.association && ` in selected association`}
      </div>
    </div>
  )
}
