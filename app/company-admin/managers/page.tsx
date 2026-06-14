import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/shell'
import { date } from '@/lib/utils'
import { UserPlus, Eye, KeyRound } from 'lucide-react'
import { inviteManager } from './actions'

export const dynamic = 'force-dynamic'

export default async function CompanyAdminManagersPage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string; error?: string }>
}) {
  const sp = await searchParams
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

  // All associations in the portfolio — for the invite picker (scope a manager).
  const { data: portfolioAssocs } = await db
    .from('associations')
    .select('id, name, unit_count')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name', { ascending: true })

  const allAssocIds = [...new Set((assocManagers ?? []).map((am: any) => am.association_id))]
  const unitCountByAssoc = new Map<string, number>()
  for (const a of portfolioAssocs ?? []) { unitCountByAssoc.set(a.id, a.unit_count ?? 0) }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Managers</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Staff and managers managing associations in your portfolio</p>
        </div>
        <form action={inviteManager} className="w-full max-w-md rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center gap-2">
            <Input name="email" type="email" required placeholder="manager@email.com" className="h-9 flex-1" aria-label="Manager email" />
            <input type="hidden" name="role_name" value="Property Manager" />
            <Button type="submit" className="gap-2"><UserPlus className="h-4 w-4" /> Invite</Button>
          </div>
          {(portfolioAssocs ?? []).length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Properties this manager can access</div>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {(portfolioAssocs ?? []).map((a: any) => (
                  <label key={a.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-gray-700 hover:bg-gray-50">
                    <input type="checkbox" name="association_ids" value={a.id} className="h-3.5 w-3.5 rounded border-gray-300" />
                    <span className="truncate">{a.name}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-gray-400">Leave all unchecked for full portfolio access.</p>
            </div>
          )}
        </form>
      </div>

      {sp.invited && <Alert tone="success" title="Invitation sent">{`Invited ${sp.invited} as a Property Manager. They'll get an email with a link to set their password.`}</Alert>}
      {sp.error && <Alert tone="danger" title="Could not invite manager">{sp.error}</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Managers', value: rows.length },
          { label: 'Total Doors Managed', value: rows.reduce((s: number, r: any) => s + r.totalDoors, 0).toLocaleString() },
          { label: 'Open Work Orders', value: rows.reduce((s: number, r: any) => s + r.openWorkOrders, 0) },
          { label: 'Overdue Work Orders', value: rows.reduce((s: number, r: any) => s + r.overdueWorkOrders, 0), warn: true },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{item.label}</div>
            <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${item.warn ? 'text-amber-700' : 'text-gray-950'}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Manager</th>
              <th className="px-4 py-2.5 text-left font-medium">Contact</th>
              <th className="px-4 py-2.5 text-right font-medium">Assoc</th>
              <th className="px-4 py-2.5 text-right font-medium">Doors</th>
              <th className="px-4 py-2.5 text-right font-medium">Open WO</th>
              <th className="px-4 py-2.5 text-right font-medium">Overdue WO</th>
              <th className="px-4 py-2.5 text-right font-medium">Violations</th>
              <th className="px-4 py-2.5 text-left font-medium">Last Login</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">No managers found in your portfolio.</td></tr>
            ) : (
              rows.map((row: any) => (
                <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/company-admin/managers/${row.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{row.name}</Link>
                    <div className="mt-0.5 text-xs capitalize text-gray-500">{row.role.replace('_', ' ')}</div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-700">{row.email}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.associationCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.totalDoors.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${row.openWorkOrders > 0 ? 'font-medium text-amber-700' : 'text-gray-700'}`}>{row.openWorkOrders}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${row.overdueWorkOrders > 0 ? 'font-semibold text-red-700' : 'text-gray-700'}`}>{row.overdueWorkOrders}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${row.openViolations > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>{row.openViolations}</td>
                  <td className="px-4 py-3 text-[13px] tabular-nums text-gray-700">{date(row.lastLogin)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/company-admin/managers/${row.id}`} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-950" title="View Profile"><Eye className="h-4 w-4" /></Link>
                      <Link href="/settings?tab=managers" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-950" title="Reset Password"><KeyRound className="h-4 w-4" /></Link>
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
