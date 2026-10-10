import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/shell'
import { StatusChip, type Tone } from '@/components/operations/status-chip'
import { Building2, Eye } from 'lucide-react'
import { todayInZone } from '@/lib/time/zoned'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { ACTIVE_VIOLATION_STATUSES } from '@/lib/violations/queries'
import { collectLoadErrors } from '@/lib/company-admin/load-errors'
import { computeAssociationHealth, healthStatus, healthTone, OPEN_WORK_ORDER_STATUSES } from '@/lib/company-admin/health'

export const dynamic = 'force-dynamic'

function HealthBadge({ score }: { score: number }) {
  const tone: Tone = healthTone(healthStatus(score))
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

  const { data: associations, error: associationsError } = await db
    .from('associations')
    // association_managers has no FK to profiles (user_id references auth.users),
    // so a nested profiles embed is unresolvable (PGRST200) and would fail the
    // whole query. Manager names are joined below from the profiles fetch.
    .select(`id, slug, name, address, city, state, zip, unit_count, status, association_managers!association_managers_association_id_fkey(user_id, ended_at)`)
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name')

  // Paged: a plain select stops at 1,000 rows and undercounted large portfolios.
  const woRes = await fetchAllRows(() => db
    .from('work_orders')
    .select('association_id, id, status, priority, scheduled_date')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .in('status', [...OPEN_WORK_ORDER_STATUSES])
    .order('id'))

  const violRes = await fetchAllRows(() => db
    .from('violations')
    .select('association_id, id')
    .is('archived_at', null)
    .in('status', [...ACTIVE_VIOLATION_STATUSES])
    .order('id'))

  // Calendar dates are the company's zone (server code runs in UTC).
  const healthByAssoc = computeAssociationHealth(
    (associations ?? []).map((a: any) => a.id),
    woRes.rows,
    violRes.rows,
    todayInZone(),
  )

  const { data: managers, error: managersError } = await db
    .from('profiles')
    .select('id, full_name, email')
    .eq('portfolio_id', portfolioId)
    .in('hoa_role', ['manager', 'company_admin'])

  const loadErrors = collectLoadErrors({ 'Work orders': woRes, Violations: violRes, Managers: managersError ? { error: managersError } : null })

  const cities = [...new Set((associations ?? []).map((a: any) => a.city).filter(Boolean))].sort() as string[]
  const profilesById = new Map<string, any>((managers ?? []).map((p: any) => [p.id, p]))

  let rows = (associations ?? []).map((assoc: any) => {
    const h = healthByAssoc.get(assoc.id)
    const healthScore = h?.score ?? 100
    const assignedMgrs = (assoc.association_managers ?? []).filter((am: any) => !am.ended_at).map((am: any) => profilesById.get(am.user_id))
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
      openWorkOrders: h?.open ?? 0,
      overdueWorkOrders: h?.overdue ?? 0,
      openViolations: h?.violations ?? 0,
      status: assoc.status ?? 'active',
    }
  })

  if (sp.manager) rows = rows.filter((r: any) => r.managerNames.toLowerCase().includes(sp.manager!.toLowerCase()))
  if (sp.city) rows = rows.filter((r: any) => r.city === sp.city)
  if (sp.health === 'healthy' || sp.health === 'warning' || sp.health === 'critical') {
    rows = rows.filter((r: any) => healthStatus(r.healthScore) === sp.health)
  }
  if (sp.status) rows = rows.filter((r: any) => r.status === sp.status)
  if (sp.min_units) rows = rows.filter((r: any) => r.units >= parseInt(sp.min_units!, 10))
  if (sp.max_units) rows = rows.filter((r: any) => r.units <= parseInt(sp.max_units!, 10))

  const selectCls = 'mt-1 block h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Associations</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">Manage all associations in your portfolio</p>
        </div>
        <Link href="/onboard">
          <Button className="gap-2"><Building2 className="h-4 w-4" /> Add Association</Button>
        </Link>
      </div>

      {associationsError && <Alert title="Could not load associations">{associationsError.message}</Alert>}
      {loadErrors.length > 0 && <Alert tone="danger" title="Some data could not be loaded; health scores may be incomplete.">{loadErrors.join(' · ')}</Alert>}

      <form action="/company-admin/associations" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <label className="text-[13px] font-medium text-gray-500">
          Manager
          <select name="manager" defaultValue={sp.manager ?? ''} className={selectCls}>
            <option value="">All Managers</option>
            {(managers ?? []).map((mgr: any) => <option key={mgr.id} value={mgr.full_name ?? mgr.email}>{mgr.full_name ?? mgr.email}</option>)}
          </select>
        </label>
        <label className="text-[13px] font-medium text-gray-500">
          City
          <select name="city" defaultValue={sp.city ?? ''} className={selectCls}>
            <option value="">All Cities</option>
            {cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </label>
        <label className="text-[13px] font-medium text-gray-500">
          Health
          <select name="health" defaultValue={sp.health ?? ''} className={selectCls}>
            <option value="">All</option>
            <option value="healthy">Healthy (80+)</option>
            <option value="warning">Warning (50-79)</option>
            <option value="critical">Critical (&lt;50)</option>
          </select>
        </label>
        <label className="text-[13px] font-medium text-gray-500">
          Status
          <select name="status" defaultValue={sp.status ?? ''} className={selectCls}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <label className="text-[13px] font-medium text-gray-500">
            Min Units
            <input type="number" name="min_units" defaultValue={sp.min_units ?? ''} placeholder="0" className={`${selectCls} w-24 placeholder:text-gray-400`} />
          </label>
          <label className="text-[13px] font-medium text-gray-500">
            Max Units
            <input type="number" name="max_units" defaultValue={sp.max_units ?? ''} placeholder="999" className={`${selectCls} w-24 placeholder:text-gray-400`} />
          </label>
        </div>
        <button type="submit" className="h-10 rounded-xl bg-gray-950 px-4 text-sm font-medium text-white transition hover:bg-gray-800">Apply</button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Association</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">City</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Units</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Manager</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Health</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Open WO</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Violations</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500">No associations match your filters.</td></tr>
            ) : (
              rows.map((row: any) => (
                <tr key={row.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                  <td className="px-4 py-3.5">
                    <Link href={`/associations/${row.slug ?? row.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{row.name}</Link>
                    <div className="mt-0.5 text-[13px] text-gray-500">{row.address}</div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-700">{row.city}{row.state ? `, ${row.state}` : ''}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-gray-700">{row.units.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-700">{row.managerNames}</td>
                  <td className="px-4 py-3.5"><HealthBadge score={row.healthScore} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={row.openWorkOrders > 0 ? 'font-medium text-amber-700' : 'text-gray-700'}>{row.openWorkOrders}</span>
                    {row.overdueWorkOrders > 0 && <span className="ml-1 text-xs text-red-700">({row.overdueWorkOrders} overdue)</span>}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${row.openViolations > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>
                    {row.openViolations}
                  </td>
                  <td className="px-4 py-3.5">
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
      <div className="text-[13px] text-gray-500">Showing {rows.length} of {associations?.length ?? 0} associations{sp.city ? ` in ${sp.city}` : ''}</div>
    </div>
  )
}
