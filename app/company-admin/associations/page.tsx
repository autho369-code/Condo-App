import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { Button } from '@/components/ui/button'
import { StatusChip, type Tone } from '@/components/operations/status-chip'
import { Building2, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

function HealthBadge({ score }: { score: number }) {
  const tone: Tone = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger'
  return <StatusChip tone={tone}>{score}%</StatusChip>
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
    .select(`id, slug, name, address, city, state, zip, unit_count, status, association_managers!association_managers_association_id_fkey(user_id, ended_at, profiles:profiles(full_name, email))`)
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
      slug: assoc.slug,
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

  const selectCls = 'mt-1 block h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Associations</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Manage all associations in your portfolio</p>
        </div>
        <Link href="/onboard">
          <Button className="gap-2"><Building2 className="h-4 w-4" /> Add Association</Button>
        </Link>
      </div>

      <form action="/company-admin/associations" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <label className="text-xs font-medium text-gray-500">
          Manager
          <select name="manager" defaultValue={sp.manager ?? ''} className={selectCls}>
            <option value="">All Managers</option>
            {(managers ?? []).map((mgr: any) => <option key={mgr.id} value={mgr.full_name ?? mgr.email}>{mgr.full_name ?? mgr.email}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">
          City
          <select name="city" defaultValue={sp.city ?? ''} className={selectCls}>
            <option value="">All Cities</option>
            {cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">
          Health
          <select name="health" defaultValue={sp.health ?? ''} className={selectCls}>
            <option value="">All</option>
            <option value="healthy">Healthy (80+)</option>
            <option value="warning">Warning (50-79)</option>
            <option value="critical">Critical (&lt;50)</option>
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">
          Status
          <select name="status" defaultValue={sp.status ?? ''} className={selectCls}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <label className="text-xs font-medium text-gray-500">
            Min Units
            <input type="number" name="min_units" defaultValue={sp.min_units ?? ''} placeholder="0" className={`${selectCls} w-24 placeholder:text-gray-400`} />
          </label>
          <label className="text-xs font-medium text-gray-500">
            Max Units
            <input type="number" name="max_units" defaultValue={sp.max_units ?? ''} placeholder="999" className={`${selectCls} w-24 placeholder:text-gray-400`} />
          </label>
        </div>
        <button type="submit" className="h-10 rounded-xl bg-gray-950 px-4 text-sm font-medium text-white transition hover:bg-gray-800">Apply</button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Association</th>
              <th className="px-4 py-2.5 text-left font-medium">City</th>
              <th className="px-4 py-2.5 text-right font-medium">Units</th>
              <th className="px-4 py-2.5 text-left font-medium">Manager</th>
              <th className="px-4 py-2.5 text-left font-medium">Health</th>
              <th className="px-4 py-2.5 text-right font-medium">Open WO</th>
              <th className="px-4 py-2.5 text-right font-medium">Violations</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500">No associations match your filters.</td></tr>
            ) : (
              rows.map((row: any) => (
                <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/associations/${row.slug ?? row.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{row.name}</Link>
                    <div className="mt-0.5 text-xs text-gray-500">{row.address}</div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-700">{row.city}{row.state ? `, ${row.state}` : ''}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.units.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-700">{row.managerNames}</td>
                  <td className="px-4 py-3"><HealthBadge score={row.healthScore} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={row.openWorkOrders > 0 ? 'font-medium text-amber-700' : 'text-gray-700'}>{row.openWorkOrders}</span>
                    {row.overdueWorkOrders > 0 && <span className="ml-1 text-xs text-red-700">({row.overdueWorkOrders} overdue)</span>}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${row.openViolations > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>
                    {row.openViolations}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/associations/${row.slug ?? row.id}`} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-950" title="View"><Eye className="h-4 w-4" /></Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-500">Showing {rows.length} of {associations?.length ?? 0} associations{sp.city ? ` in ${sp.city}` : ''}</div>
    </div>
  )
}
