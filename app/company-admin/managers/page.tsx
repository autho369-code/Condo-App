import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { Button } from '@/components/ui/button'
import { date } from '@/lib/utils'
import { UserPlus, Eye, Ban, KeyRound, ArrowRightLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CompanyAdminManagersPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const today = new Date().toISOString().slice(0, 10)

  const { data: managers } = await db
    .from('profiles')
    .select('id, full_name, email, hoa_role, last_login_at')
    .eq('portfolio_id', portfolioId)
    .in('hoa_role', ['manager', 'company_admin'])
    .order('full_name', { ascending: true, nullsFirst: false })

  const managerIds = (managers ?? []).map((m: any) => m.id)

  const { data: assocManagers } = await db
    .from('association_managers')
    .select('user_id, association_id')
    .in('user_id', managerIds)
    .is('ended_at', null)

  const assocByManager = new Map<string, string[]>()
  for (const am of assocManagers ?? []) {
    if (!assocByManager.has(am.user_id)) assocByManager.set(am.user_id, [])
    assocByManager.get(am.user_id)!.push(am.association_id)
  }

  const allAssocIds = [...new Set((assocManagers ?? []).map((am: any) => am.association_id))]
  const { data: assocs } = await db.from('associations').select('id, unit_count').in('id', allAssocIds)
  const unitCountByAssoc = new Map<string, number>()
  for (const a of assocs ?? []) { unitCountByAssoc.set(a.id, a.unit_count ?? 0) }

  const { data: workOrders } = await db
    .from('work_orders')
    .select('assignee_id, status, scheduled_date')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .not('status', 'in', '("completed","closed","cancelled")')
    .in('assignee_id', managerIds)

  const woByManager = new Map<string, { open: number; overdue: number }>()
  for (const wo of workOrders ?? []) {
    if (!wo.assignee_id) continue
    if (!woByManager.has(wo.assignee_id)) woByManager.set(wo.assignee_id, { open: 0, overdue: 0 })
    const entry = woByManager.get(wo.assignee_id)!
    entry.open++
    if (wo.scheduled_date && wo.scheduled_date < today) entry.overdue++
  }

  const { data: violations } = await db
    .from('violations')
    .select('association_id, id')
    .is('archived_at', null)
    .not('status', 'in', '("closed","cured")')
    .in('association_id', allAssocIds.length > 0 ? allAssocIds : ['none'])

  const violByAssoc = new Map<string, number>()
  for (const v of violations ?? []) { violByAssoc.set(v.association_id, (violByAssoc.get(v.association_id) ?? 0) + 1) }

  const rows = (managers ?? []).map((mgr: any) => {
    const assocIds = assocByManager.get(mgr.id) ?? []
    const totalDoors = assocIds.reduce((sum, aid) => sum + (unitCountByAssoc.get(aid) ?? 0), 0)
    const wo = woByManager.get(mgr.id) ?? { open: 0, overdue: 0 }
    const totalViols = assocIds.reduce((sum, aid) => sum + (violByAssoc.get(aid) ?? 0), 0)
    return {
      id: mgr.id,
      name: mgr.full_name ?? mgr.email ?? 'Unknown',
      email: mgr.email ?? '—',
      role: mgr.hoa_role ?? 'manager',
      associationCount: assocIds.length,
      totalDoors,
      openWorkOrders: wo.open,
      overdueWorkOrders: wo.overdue,
      openViolations: totalViols,
      lastLogin: mgr.last_login_at,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Managers</h1>
          <p className="mt-1 text-sm text-slate-400">Staff and managers managing associations in your portfolio</p>
        </div>
        <Link href="/settings?tab=managers">
          <Button className="gap-2"><UserPlus className="h-4 w-4" /> Invite Manager</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Managers', value: rows.length },
          { label: 'Total Doors Managed', value: rows.reduce((s: number, r: any) => s + r.totalDoors, 0).toLocaleString() },
          { label: 'Open Work Orders', value: rows.reduce((s: number, r: any) => s + r.openWorkOrders, 0) },
          { label: 'Overdue Work Orders', value: rows.reduce((s: number, r: any) => s + r.overdueWorkOrders, 0), warn: true },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
            <div className="text-xs font-medium uppercase text-slate-500">{item.label}</div>
            <div className={`mt-1 text-2xl font-bold ${item.warn ? 'text-amber-400' : 'text-white'}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
              <th className="px-4 py-3 text-left font-medium">Manager</th>
              <th className="px-4 py-3 text-left font-medium">Contact</th>
              <th className="px-4 py-3 text-right font-medium">Assoc</th>
              <th className="px-4 py-3 text-right font-medium">Doors</th>
              <th className="px-4 py-3 text-right font-medium">Open WO</th>
              <th className="px-4 py-3 text-right font-medium">Overdue WO</th>
              <th className="px-4 py-3 text-right font-medium">Violations</th>
              <th className="px-4 py-3 text-left font-medium">Last Login</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">No managers found in your portfolio.</td></tr>
            ) : (
              rows.map((row: any) => (
                <tr key={row.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/company-admin/managers/${row.id}`} className="font-medium text-slate-200 hover:text-emerald-400">{row.name}</Link>
                    <div className="mt-0.5 text-xs text-slate-600 capitalize">{row.role.replace('_', ' ')}</div>
                  </td>
                  <td className="px-4 py-3"><div className="text-slate-400">{row.email}</div></td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{row.associationCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{row.totalDoors.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.openWorkOrders > 0 ? <span className="text-amber-400">{row.openWorkOrders}</span> : <span className="text-emerald-400">0</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.overdueWorkOrders > 0 ? <span className="text-red-400">{row.overdueWorkOrders}</span> : <span className="text-emerald-400">0</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.openViolations > 0 ? <span className="text-red-400">{row.openViolations}</span> : <span className="text-emerald-400">0</span>}</td>
                  <td className="px-4 py-3 text-slate-400">{date(row.lastLogin)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/company-admin/managers/${row.id}`} className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300" title="View Profile"><Eye className="h-4 w-4" /></Link>
                      <Link href="/settings?tab=managers" className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300" title="Reset Password"><KeyRound className="h-4 w-4" /></Link>
                      <Link href={`/company-admin/managers/${row.id}/reassign`} className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300" title="Reassign"><ArrowRightLeft className="h-4 w-4" /></Link>
                      <button className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-red-400" title="Disable"><Ban className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
