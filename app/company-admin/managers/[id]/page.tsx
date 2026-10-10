import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { Alert } from '@/components/ui/shell'
import { ArrowLeft, Activity } from 'lucide-react'
import { resetManagerMfa, setManagerLoginStatus, updateManagerAssociations } from '../actions'
import { MfaResetButton } from '@/components/auth/mfa-reset-button'
import { PendingSubmit } from '@/components/ui/pending-submit'
import { todayInZone } from '@/lib/time/zoned'
import { effectiveManagerScope } from '@/lib/company-admin/manager-scope'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-[13px] text-gray-500">{label}</span>
      <span className="text-right text-sm text-gray-900">{value}</span>
    </div>
  )
}

export default async function ManagerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; disabled?: string; enabled?: string; mfa_reset?: string; error?: string }> }) {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const { id } = await params
  const sp = await searchParams
  const today = todayInZone()

  const { data: manager } = await db
    .from('profiles')
    .select('id, full_name, email, hoa_role, last_login_at, created_at, disabled_at, mfa_enrolled_at')
    .eq('id', id)
    .eq('portfolio_id', portfolioId)
    .maybeSingle()

  if (!manager || manager.hoa_role !== 'manager') notFound()

  // A failed load is an error: no rows means full portfolio access.
  // Every assignment (paged): the scope form below is saved from these rows,
  // so a truncated list would revoke the assignments it left out.
  const { rows: assocManagers, error: assocManagersError } = await fetchAllRows<any>(() => db
    .from('association_managers')
    .select(`id, association_id, assigned_at, associations:association_id(id, name, unit_count, city, state)`)
    .eq('user_id', id)
    .is('ended_at', null)
    .order('id'))
  if (assocManagersError) throw new Error(`Could not load this manager's assignments: ${assocManagersError}`)

  const assignedAssocs = (assocManagers ?? []).map((am: any) => ({
    id: am.associations?.id,
    name: am.associations?.name ?? 'Unknown',
    unitCount: am.associations?.unit_count ?? 0,
    city: am.associations?.city,
    state: am.associations?.state,
    assignedAt: am.assigned_at,
  }))

  const assignedSet = new Set(assignedAssocs.map((a: any) => a.id))

  // All associations in the portfolio, for the scope editor.
  const { rows: portfolioAssocs, error: portfolioAssocsError } = await fetchAllRows<any>(() => db
    .from('associations')
    .select('id, name, unit_count, city, state')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name', { ascending: true })
    .order('id'))
  if (portfolioAssocsError) throw new Error(`Could not load associations: ${portfolioAssocsError}`)

  // No rows = full portfolio access, so workload covers every association.
  const scope = effectiveManagerScope((assocManagers ?? []).map((am: any) => am.association_id), (portfolioAssocs ?? []).map((a: any) => a.id))
  const assocIds = scope.associationIds
  const unitCountById = new Map<string, number>((portfolioAssocs ?? []).map((a: any) => [a.id, a.unit_count ?? 0]))

  const { data: allWorkOrders } = await db
    .from('work_orders')
    .select('id, status, scheduled_date')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .eq('assignee_id', id)

  const openWorkOrders = (allWorkOrders ?? []).filter((wo: any) => !['done', 'completed', 'billed', 'closed', 'cancelled'].includes(wo.status))
  const overdueWorkOrders = openWorkOrders.filter((wo: any) => wo.scheduled_date && wo.scheduled_date < today)

  let openViolations = 0
  if (assocIds.length > 0) {
    // Always scoped to this company through the association (platform operators
    // pass requirePortfolioAdmin and their RLS is global). Full access filters by
    // company instead of the id list, which would not fit in the request URL.
    let violationQuery = db
      .from('violations')
      .select('id, associations!violations_association_id_fkey!inner(portfolio_id)', { count: 'exact', head: true })
      .eq('associations.portfolio_id', portfolioId)
      .is('archived_at', null)
      .not('status', 'in', '("closed","cured")')
    if (!scope.fullAccess) violationQuery = violationQuery.in('association_id', assocIds)
    const { count } = await violationQuery
    openViolations = count ?? 0
  }

  // The audit trail records what this manager changed (the `activity` table is
  // an internal agent log and never has rows for people).
  const { data: auditRows } = await db
    .from('audit_logs')
    .select('action, entity_type, created_at')
    .eq('actor_id', id)
    .eq('portfolio_id', me.portfolio?.id)
    .order('created_at', { ascending: false })
    .limit(15)
  const recentActivity = (auditRows ?? []).map((r: any) => ({
    action: String(r.action ?? '').replace(/_/g, ' ').replace(/:/g, ' · ').replace(/^\w/, (c: string) => c.toUpperCase()),
    details: r.entity_type ? String(r.entity_type).replace(/_/g, ' ') : null,
    created_at: r.created_at,
  }))

  const totalDoorsManaged = assocIds.reduce((sum: number, aid: string) => sum + (unitCountById.get(aid) ?? 0), 0)
  const workloadRatio = openWorkOrders.length > 0 ? Math.round((1 - overdueWorkOrders.length / openWorkOrders.length) * 100) : 100

  return (
    <div className="space-y-6">
      <Link href="/company-admin/managers" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-950">
        <ArrowLeft className="h-4 w-4" /> Back to Managers
      </Link>

      {sp.saved && <Alert tone="success" title="Saved">Association access updated for this manager.</Alert>}
      {sp.disabled && <Alert tone="success" title="Manager disabled">The manager&apos;s active sessions and login access have been revoked.</Alert>}
      {sp.enabled && <Alert tone="success" title="Manager enabled">The manager can sign in again.</Alert>}
      {sp.mfa_reset && <Alert tone="success" title="Authenticator reset">The manager must set up a new authenticator at the next sign-in.</Alert>}
      {sp.error && <Alert tone="danger" title="Could not update access">{sp.error}</Alert>}

      <div className={card}>
        <div className="border-b border-gray-100 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-xl font-semibold text-gray-700 ring-1 ring-inset ring-gray-200/70">
                {(manager.full_name ?? manager.email ?? '?')[0].toUpperCase()}
              </div>
              <div>
                <h1 className="break-words font-display text-[24px] font-bold leading-[1.15] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[28px]">{manager.full_name ?? manager.email}</h1>
                <div className="mt-1 text-sm capitalize text-gray-500">{(manager.hoa_role ?? 'manager').replace('_', ' ')}</div>
                {manager.disabled_at && <div className="mt-1 text-xs font-medium text-red-700">Login disabled</div>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <MfaResetButton action={resetManagerMfa} userId={manager.id} />
              <form action={setManagerLoginStatus}>
                <input type="hidden" name="manager_id" value={manager.id} />
                <input type="hidden" name="action" value={manager.disabled_at ? 'enable' : 'disable'} />
                <PendingSubmit variant={manager.disabled_at ? 'secondary' : 'danger'} pendingLabel="Saving…">
                  {manager.disabled_at ? 'Enable login' : 'Disable login'}
                </PendingSubmit>
              </form>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-0 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="p-6">
            <div className="text-[13px] font-medium text-gray-500">Contact</div>
            <div className="mt-3 space-y-1">
              <InfoRow label="Email" value={manager.email ?? '—'} />
              <InfoRow label="Last Login" value={date(manager.last_login_at)} />
              <InfoRow label="Joined" value={date(manager.created_at)} />
              <InfoRow label="MFA" value={manager.mfa_enrolled_at ? 'Enrolled' : 'Not enrolled'} />
            </div>
          </div>
          <div className="p-6">
            <div className="text-[13px] font-medium text-gray-500">Workload</div>
            <div className="mt-3 space-y-1">
              <InfoRow label="Associations" value={scope.fullAccess ? `All (${assocIds.length})` : assocIds.length} />
              <InfoRow label="Doors Managed" value={totalDoorsManaged.toLocaleString()} />
              <InfoRow label="Open Work Orders" value={<span className={openWorkOrders.length > 0 ? 'font-medium text-amber-700' : 'text-gray-900'}>{openWorkOrders.length}</span>} />
              <InfoRow label="Overdue WO" value={<span className={overdueWorkOrders.length > 0 ? 'font-medium text-red-700' : 'text-gray-900'}>{overdueWorkOrders.length}</span>} />
              <InfoRow label="Open Violations" value={<span className={openViolations > 0 ? 'font-medium text-red-700' : 'text-gray-900'}>{openViolations}</span>} />
            </div>
          </div>
        </div>
      </div>

      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-medium text-gray-500">Workload Score</div>
            <div className="mt-1 text-lg text-gray-600">
              {openWorkOrders.length > 0 ? `${overdueWorkOrders.length} overdue / ${openWorkOrders.length} open` : 'No open work orders'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16">
              <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#F3F4F6" strokeWidth="6" />
                <circle cx="32" cy="32" r="28" fill="none" stroke={workloadRatio >= 80 ? '#10B981' : workloadRatio >= 50 ? '#F59E0B' : '#EF4444'} strokeWidth="6" strokeDasharray={`${(workloadRatio / 100) * 176} 176`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-semibold tabular-nums text-gray-950">{workloadRatio}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <form action={updateManagerAssociations} className={card}>
        <input type="hidden" name="manager_id" value={id} />
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Property Access</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">Check the associations this manager can access. None checked = full portfolio access.</p>
          </div>
          <PendingSubmit pendingLabel="Saving…">Save access</PendingSubmit>
        </div>
        <div className="divide-y divide-gray-50">
          {(portfolioAssocs ?? []).length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">No associations in this portfolio yet.</div>
          ) : (
            (portfolioAssocs ?? []).map((assoc: any) => (
              <label key={assoc.id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50/60">
                <input
                  type="checkbox"
                  name="association_ids"
                  value={assoc.id}
                  defaultChecked={assignedSet.has(assoc.id)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">{assoc.name}</div>
                  <div className="text-[13px] text-gray-500">{[assoc.city, assoc.state].filter(Boolean).join(', ') || '—'} · {assoc.unit_count ?? 0} units</div>
                </div>
              </label>
            ))
          )}
        </div>
      </form>

      <div className={card}>
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Recent Activity</h2>
        </div>
        <div className="divide-y divide-line">
          {(recentActivity ?? []).length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">No recent activity recorded.</div>
          ) : (
            (recentActivity ?? []).map((act: any, i: number) => (
              <div key={i} className="flex items-start gap-3 px-6 py-3">
                <Activity className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900">{act.action}</div>
                  {act.details && <div className="mt-0.5 text-[13px] text-gray-500">{act.details}</div>}
                </div>
                <div className="flex-shrink-0 text-xs text-gray-400">{date(act.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
