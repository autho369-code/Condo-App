import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { Button } from '@/components/ui/button'
import { Building2, Eye, Pencil, UserCog, MoreHorizontal } from 'lucide-react'

export const dynamic = 'force-dynamic'

function HealthBadge({ score }: { score: number }) {
  if (score >= 80) {
    return <span className="inline-flex h-6 items-center rounded-full bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">{score}%</span>
  }
  if (score >= 50) {
    return <span className="inline-flex h-6 items-center rounded-full bg-amber-500/10 px-2.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">{score}%</span>
  }
  return <span className="inline-flex h-6 items-center rounded-full bg-red-500/10 px-2.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20">{score}%</span>
}

export default async function CompanyAdminAssociationsPage({
  searchParams,
}: {
  searchParams: Promise<{ manager?: string; city?: string; health?: string; status?: string; min_units?: string; max_units?: string }>
}) {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const sp = await searchParams

  const { data: associations } = await db
    .from('associations')
    .select(`id, name, address, city, state, zip, unit_count, status, association_managers!association_managers_association_id_fkey(user_id, profiles:profiles(full_name, email))`)
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name')

  const { data: woCounts } = await db
    .from('work_orders')
    .select('association_id, id, status, scheduled_date')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .not('status', 'in', '("completed","closed","cancelled")')

  const today = new Date().toISOString().slice(0, 10)
  const woByAssoc = new Map<string, { open: number; overdue: number }>()
  for (const wo of woCounts ?? []) {
    if (!woByAssoc.has(wo.association_id)) woByAssoc.set(wo.association_id, { open: 0, overdue: 0 })
    const entry = woByAssoc.get(wo.association_id)!
    entry.open++
    if (wo.scheduled_date && wo.scheduled_date < today) entry.overdue++
  }

  const { data: violCounts } = await db
    .from('violations')
    .select('association_id, id')
    .is('archived_at', null)
    .not('status', 'in', '("closed","cured")')

  const violByAssoc = new Map<string, number>()
  for (const v of violCounts ?? []) {
    violByAssoc.set(v.association_id, (violByAssoc.get(v.association_id) ?? 0) + 1)
  }

  const { data: managers } = await db
    .from('profiles')
    .select('id, full_name, email')
    .eq('portfolio_id', portfolioId)
    .in('hoa_role', ['manager', 'company_admin'])

  const cities = [...new Set((associations ?? []).map((a: any) => a.city).filter(Boolean))].sort() as string[]

  let rows = (associations ?? []).map((assoc: any) => {
    const wo = woByAssoc.get(assoc.id) ?? { open: 0, overdue: 0 }
    const viol = violByAssoc.get(assoc.id) ?? 0
    const rawScore = 100 - (wo.overdue * 8 + wo.open * 3 + viol * 4)
    const healthScore = Math.max(0, Math.min(100, rawScore))
    const assignedMgrs = (assoc.association_managers ?? []).filter((am: any) => !am.ended_at).map((am: any) => am.profiles)
    return {
      id: assoc.id,
      name: assoc.name,
      address: assoc.address,
      city: assoc.city,
      state: assoc.state,
      units: assoc.unit_count ?? 0,
      managerNames: assignedMgrs.map((p: any) => p?.full_name ?? p?.email ?? 'Unknown').join(', ') || '—',
      healthScore,
      openWorkOrders: wo.open,
      overdueWorkOrders: wo.overdue,
      openViolations: viol,
      status: assoc.status ?? 'active',
    }
  })

  if (sp.manager) rows = rows.filter((r: any) => r.managerNames.toLowerCase().includes(sp.manager!.toLowerCase()))
  if (sp.city) rows = rows.filter((r: any) => r.city === sp.city)
  if (sp.health) {
    if (sp.health === 'healthy') rows = rows.filter((r: any) => r.healthScore >= 80)
    if (sp.health === 'warning') rows = rows.filter((r: any) => r.healthScore >= 50 && r.healthScore < 80)
    if (sp.health === 'critical') rows = rows.filter((r: any) => r.healthScore < 50)
  }
  if (sp.status) rows = rows.filter((r: any) => r.status === sp.status)
  if (sp.min_units) rows = rows.filter((r: any) => r.units >= parseInt(sp.min_units!, 10))
  if (sp.max_units) rows = rows.filter((r: any) => r.units <= parseInt(sp.max_units!, 10))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Associations</h1>
          <p className="mt-1 text-sm text-slate-400">Manage all associations in your portfolio</p>
        </div>
        <Link href="/onboard">
          <Button className="gap-2"><Building2 className="h-4 w-4" /> Add Association</Button>
        </Link>
      </div>

      <form action="/company-admin/associations" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
        <label className="text-xs font-medium uppercase text-slate-500">
          Manager
          <select name="manager" defaultValue={sp.manager ?? ''} className="mt-1 block h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="">All Managers</option>
            {(managers ?? []).map((mgr: any) => <option key={mgr.id} value={mgr.full_name ?? mgr.email}>{mgr.full_name ?? mgr.email}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium uppercase text-slate-500">
          City
          <select name="city" defaultValue={sp.city ?? ''} className="mt-1 block h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="">All Cities</option>
            {cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium uppercase text-slate-500">
          Health
          <select name="health" defaultValue={sp.health ?? ''} className="mt-1 block h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="">All</option>
            <option value="healthy">Healthy (80+)</option>
            <option value="warning">Warning (50-79)</option>
            <option value="critical">Critical (&lt;50)</option>
          </select>
        </label>
        <label className="text-xs font-medium uppercase text-slate-500">
          Status
          <select name="status" defaultValue={sp.status ?? ''} className="mt-1 block h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <label className="text-xs font-medium uppercase text-slate-500">
            Min Units
            <input type="number" name="min_units" defaultValue={sp.min_units ?? ''} placeholder="0" className="mt-1 block h-9 w-24 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="text-xs font-medium uppercase text-slate-500">
            Max Units
            <input type="number" name="max_units" defaultValue={sp.max_units ?? ''} placeholder="999" className="mt-1 block h-9 w-24 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
        </div>
        <button type="submit" className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">Apply</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
              <th className="px-4 py-3 text-left font-medium">Association</th>
              <th className="px-4 py-3 text-left font-medium">City</th>
              <th className="px-4 py-3 text-right font-medium">Units</th>
              <th className="px-4 py-3 text-left font-medium">Manager</th>
              <th className="px-4 py-3 text-left font-medium">Health</th>
              <th className="px-4 py-3 text-right font-medium">Open WO</th>
              <th className="px-4 py-3 text-right font-medium">Violations</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No associations match your filters.</td></tr>
            ) : (
              rows.map((row: any) => (
                <tr key={row.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/associations/${row.id}`} className="font-medium text-slate-200 hover:text-emerald-400">{row.name}</Link>
                    <div className="mt-0.5 text-xs text-slate-600">{row.address}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{row.city}{row.state ? `, ${row.state}` : ''}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{row.units.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-400">{row.managerNames}</td>
                  <td className="px-4 py-3"><HealthBadge score={row.healthScore} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.openWorkOrders > 0 ? <span className="text-amber-400">{row.openWorkOrders}</span> : <span className="text-emerald-400">0</span>}
                    {row.overdueWorkOrders > 0 && <span className="ml-1 text-xs text-red-400">({row.overdueWorkOrders} overdue)</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.openViolations > 0 ? <span className="text-red-400">{row.openViolations}</span> : <span className="text-emerald-400">0</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/associations/${row.id}`} className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300" title="View"><Eye className="h-4 w-4" /></Link>
                      <Link href={`/associations/${row.id}/edit`} className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300" title="Edit"><Pencil className="h-4 w-4" /></Link>
                      <Link href={`/associations/${row.id}/managers`} className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300" title="Assign Manager"><UserCog className="h-4 w-4" /></Link>
                      <button className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-red-400" title="More"><MoreHorizontal className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-600">Showing {rows.length} of {associations?.length ?? 0} associations{sp.city ? ` in ${sp.city}` : ''}</div>
    </div>
  )
}
