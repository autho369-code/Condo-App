import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
import { ShieldAlert, FileWarning, AlertTriangle, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

const VENDOR_COMPLIANCE_FIELDS: { key: string; label: string }[] = [
  { key: 'general_liability_expiration', label: 'General Liability (COI)' },
  { key: 'workers_comp_expiration', label: 'Workers Comp' },
  { key: 'auto_insurance_expiration', label: 'Auto Insurance' },
  { key: 'state_license_expiration', label: 'State License' },
  { key: 'epa_certification_expiration', label: 'EPA Certification' },
  { key: 'contract_expiration', label: 'Contract' },
]

export default async function CompliancePage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const today = new Date().toISOString().slice(0, 10)
  const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)

  const [
    { data: vendors },
    { data: policies },
    { data: viols },
    { data: assocs },
    { data: certTasks },
  ] = await Promise.all([
    db.from('vendors')
      .select('id, name, trade, general_liability_expiration, workers_comp_expiration, auto_insurance_expiration, state_license_expiration, epa_certification_expiration, contract_expiration, send_1099, taxpayer_id')
      .eq('portfolio_id', portfolioId)
      .is('archived_at', null),
    db.from('insurance_policies')
      .select('id, owner_id, association_id, policy_number, expiration_date, status, owners(full_name)')
      .is('archived_at', null)
      .in('status', ['active', 'expiring_soon'])
      .order('expiration_date'),
    db.from('violations').select('association_id').is('archived_at', null).not('status', 'in', '("closed","cured","violation_dismissed")'),
    db.from('associations').select('id, name, slug').eq('portfolio_id', portfolioId).is('archived_at', null).order('name'),
    // Statutory certifications tracked as preventive maintenance (fire, elevator, boiler, backflow).
    db.from('maintenance_tasks')
      .select('id, task_name, category, association_id, next_due_date, status, associations(name)')
      .is('archived_at', null)
      .or('task_name.ilike.%fire%,task_name.ilike.%elevator%,task_name.ilike.%boiler%,task_name.ilike.%backflow%,task_name.ilike.%sprinkler%,task_name.ilike.%generator%')
      .order('next_due_date'),
  ])

  // ── Vendor compliance issues ─────────────────────────────────
  type Issue = { vendor: string; item: string; state: 'missing' | 'expired' | 'expiring'; date?: string }
  const vendorIssues: Issue[] = []
  for (const v of vendors ?? []) {
    for (const f of VENDOR_COMPLIANCE_FIELDS) {
      const value = v[f.key]
      if (!value) {
        // Only COI, workers comp, and license count as "missing" requirements.
        if (['general_liability_expiration', 'workers_comp_expiration', 'state_license_expiration'].includes(f.key)) {
          vendorIssues.push({ vendor: v.name, item: f.label, state: 'missing' })
        }
      } else if (value < today) {
        vendorIssues.push({ vendor: v.name, item: f.label, state: 'expired', date: value })
      } else if (value <= in60) {
        vendorIssues.push({ vendor: v.name, item: f.label, state: 'expiring', date: value })
      }
    }
    if (v.send_1099 && !v.taxpayer_id) {
      vendorIssues.push({ vendor: v.name, item: 'W-9 / Taxpayer ID', state: 'missing' })
    }
  }
  const missingCount = vendorIssues.filter((i) => i.state === 'missing').length
  const expiredCount = vendorIssues.filter((i) => i.state === 'expired').length
  const expiringCount = vendorIssues.filter((i) => i.state === 'expiring').length

  // ── Owner insurance ──────────────────────────────────────────
  const expiredPolicies = (policies ?? []).filter((p: any) => p.expiration_date && p.expiration_date < today)
  const expiringPolicies = (policies ?? []).filter((p: any) => p.expiration_date && p.expiration_date >= today && p.expiration_date <= in60)

  // ── Violations per association ───────────────────────────────
  const assocIds = new Set((assocs ?? []).map((a: any) => a.id))
  const violByAssoc = new Map<string, number>()
  let openViolations = 0
  for (const v of viols ?? []) {
    if (!assocIds.has(v.association_id)) continue
    openViolations++
    violByAssoc.set(v.association_id, (violByAssoc.get(v.association_id) ?? 0) + 1)
  }

  const stateTone = (s: Issue['state']) => (s === 'missing' ? 'danger' : s === 'expired' ? 'danger' : 'warning')
  const stateLabel = (s: Issue['state']) => (s === 'missing' ? 'Missing' : s === 'expired' ? 'Expired' : 'Expiring soon')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Compliance</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Company-wide compliance posture — vendor credentials, owner insurance, violations, and statutory inspections
        </p>
      </div>

      {/* ── KPIs ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Missing Credentials', value: missingCount, icon: FileWarning, warn: missingCount > 0 },
          { label: 'Expired Credentials', value: expiredCount, icon: ShieldAlert, warn: expiredCount > 0 },
          { label: 'Expiring in 60 Days', value: expiringCount + expiringPolicies.length, icon: ShieldCheck, warn: false },
          { label: 'Open Violations', value: openViolations, icon: AlertTriangle, warn: openViolations > 0 },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className={`${card} px-4 py-3.5`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{item.label}</div>
                  <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${item.warn ? 'text-red-700' : 'text-gray-950'}`}>{item.value}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Icon className="h-4.5 w-4.5 text-gray-400" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Vendor credential issues ──────────────────── */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Vendor Credentials</h2>
          <p className="mt-0.5 text-xs text-gray-500">Missing, expired, and soon-to-expire COIs, workers comp, licenses, and contracts</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Vendor</th>
                <th className="px-5 py-2.5 text-left font-medium">Credential</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
                <th className="px-5 py-2.5 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {vendorIssues.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">No vendor compliance issues — all credentials current.</td></tr>
              ) : (
                vendorIssues.map((issue, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-900">{issue.vendor}</td>
                    <td className="px-5 py-3 text-[13px] text-gray-700">{issue.item}</td>
                    <td className="px-5 py-3"><StatusChip tone={stateTone(issue.state)}>{stateLabel(issue.state)}</StatusChip></td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{issue.date ? date(issue.date) : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Owner insurance ───────────────────────────── */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Owner Insurance</h2>
          <p className="mt-0.5 text-xs text-gray-500">Expired and expiring HO-6 / owner policies on file</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Owner</th>
                <th className="px-5 py-2.5 text-left font-medium">Policy #</th>
                <th className="px-5 py-2.5 text-left font-medium">Expires</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {expiredPolicies.length + expiringPolicies.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">No expired or expiring owner policies.</td></tr>
              ) : (
                [...expiredPolicies, ...expiringPolicies].map((p: any) => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-900">{p.owners?.full_name ?? '—'}</td>
                    <td className="px-5 py-3 text-[13px] text-gray-700">{p.policy_number ?? '—'}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(p.expiration_date)}</td>
                    <td className="px-5 py-3">
                      <StatusChip tone={p.expiration_date < today ? 'danger' : 'warning'}>{p.expiration_date < today ? 'Expired' : 'Expiring soon'}</StatusChip>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Statutory inspections & certificates ──────── */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Statutory Inspections & Certificates</h2>
          <p className="mt-0.5 text-xs text-gray-500">Fire, elevator, boiler, backflow, sprinkler, and generator items tracked as preventive maintenance</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Item</th>
                <th className="px-5 py-2.5 text-left font-medium">Association</th>
                <th className="px-5 py-2.5 text-left font-medium">Next Due</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(certTasks ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">
                    No statutory inspection tasks yet. Add fire alarm testing, elevator, boiler, and backflow items under{' '}
                    <Link href="/maintenance" className="font-medium text-gray-700 underline">Preventive Maintenance</Link> and they will be tracked here.
                  </td>
                </tr>
              ) : (
                (certTasks ?? []).map((t: any) => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-900">{t.task_name}</td>
                    <td className="px-5 py-3 text-[13px] text-gray-700">{t.associations?.name ?? '—'}</td>
                    <td className={`px-5 py-3 text-[13px] tabular-nums ${t.next_due_date && t.next_due_date < today ? 'font-medium text-red-700' : 'text-gray-700'}`}>{date(t.next_due_date)}</td>
                    <td className="px-5 py-3"><StatusChip tone={t.next_due_date && t.next_due_date < today ? 'danger' : 'success'}>{t.next_due_date && t.next_due_date < today ? 'Overdue' : 'Scheduled'}</StatusChip></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Violations by association ─────────────────── */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Open Violations by Association</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Association</th>
                <th className="px-5 py-2.5 text-right font-medium">Open Violations</th>
              </tr>
            </thead>
            <tbody>
              {(assocs ?? []).map((a: any) => (
                <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-5 py-3">
                    <Link href={`/company-admin/violations`} className="font-medium text-gray-900 hover:underline">{a.name}</Link>
                  </td>
                  <td className={`px-5 py-3 text-right tabular-nums ${(violByAssoc.get(a.id) ?? 0) > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>{violByAssoc.get(a.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
