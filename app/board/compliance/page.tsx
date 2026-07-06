import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
import { ShieldAlert, ClipboardCheck, FileWarning } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

const VENDOR_FIELDS: { key: string; label: string }[] = [
  { key: 'general_liability_expiration', label: 'General Liability (COI)' },
  { key: 'workers_comp_expiration', label: 'Workers Comp' },
  { key: 'state_license_expiration', label: 'State License' },
  { key: 'contract_expiration', label: 'Contract' },
]

export default async function BoardCompliancePage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []
  const today = new Date().toISOString().slice(0, 10)
  const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)

  const [{ data: tasks }, { data: inspections }, { data: vendors }] = await Promise.all([
    // Statutory certification items tracked as preventive maintenance.
    db.from('maintenance_tasks')
      .select('id, task_name, category, next_due_date, status, last_completed_at')
      .in('association_id', ids)
      .is('archived_at', null)
      .order('next_due_date'),
    db.from('inspections')
      .select('id, inspection_type, scheduled_date, completed_date, status')
      .in('association_id', ids)
      .is('archived_at', null)
      .order('scheduled_date', { ascending: false })
      .limit(50),
    db.from('vendors')
      .select('id, name, trade, general_liability_expiration, workers_comp_expiration, state_license_expiration, contract_expiration')
      .is('archived_at', null),
  ])

  const statutory = (tasks ?? []).filter((t: any) =>
    /fire|elevator|boiler|backflow|sprinkler|generator|alarm/i.test(`${t.task_name} ${t.category ?? ''}`))
  const otherTasks = (tasks ?? []).filter((t: any) => !statutory.includes(t))
  const overdueStatutory = statutory.filter((t: any) => t.next_due_date && t.next_due_date < today).length

  type Issue = { vendor: string; item: string; state: 'expired' | 'expiring'; date: string }
  const vendorIssues: Issue[] = []
  for (const v of vendors ?? []) {
    for (const f of VENDOR_FIELDS) {
      const value = v[f.key]
      if (!value) continue
      if (value < today) vendorIssues.push({ vendor: v.name, item: f.label, state: 'expired', date: value })
      else if (value <= in60) vendorIssues.push({ vendor: v.name, item: f.label, state: 'expiring', date: value })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Compliance</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Statutory inspections, certificates, and vendor credential status for your association
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          { label: 'Statutory Items Tracked', value: statutory.length, icon: ClipboardCheck, warn: false },
          { label: 'Overdue Statutory Items', value: overdueStatutory, icon: ShieldAlert, warn: overdueStatutory > 0 },
          { label: 'Vendor Credential Issues', value: vendorIssues.length, icon: FileWarning, warn: vendorIssues.some((i) => i.state === 'expired') },
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

      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Statutory Inspections & Certificates</h2>
          <p className="mt-0.5 text-xs text-gray-500">Fire alarm, elevator, boiler, backflow, sprinkler, and generator items</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Item</th>
                <th className="px-5 py-2.5 text-left font-medium">Last Completed</th>
                <th className="px-5 py-2.5 text-left font-medium">Next Due</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {statutory.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">No statutory inspection items scheduled yet — ask your manager to add fire, elevator, boiler, and backflow items to the preventive maintenance calendar.</td></tr>
              ) : (
                statutory.map((t: any) => {
                  const isOverdue = t.next_due_date && t.next_due_date < today
                  return (
                    <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-5 py-3 font-medium text-gray-900">{t.task_name}</td>
                      <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(t.last_completed_at)}</td>
                      <td className={`px-5 py-3 text-[13px] tabular-nums ${isOverdue ? 'font-medium text-red-700' : 'text-gray-700'}`}>{date(t.next_due_date)}</td>
                      <td className="px-5 py-3"><StatusChip tone={isOverdue ? 'danger' : 'success'}>{isOverdue ? 'Overdue' : 'Scheduled'}</StatusChip></td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Vendor Credentials</h2>
          <p className="mt-0.5 text-xs text-gray-500">Expired and soon-to-expire insurance certificates, licenses, and contracts</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Vendor</th>
                <th className="px-5 py-2.5 text-left font-medium">Credential</th>
                <th className="px-5 py-2.5 text-left font-medium">Date</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {vendorIssues.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">No vendor credential issues.</td></tr>
              ) : (
                vendorIssues.map((i, idx) => (
                  <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-900">{i.vendor}</td>
                    <td className="px-5 py-3 text-[13px] text-gray-700">{i.item}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(i.date)}</td>
                    <td className="px-5 py-3"><StatusChip tone={i.state === 'expired' ? 'danger' : 'warning'}>{i.state === 'expired' ? 'Expired' : 'Expiring soon'}</StatusChip></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {otherTasks.length > 0 && (
        <div className={card}>
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-950">Other Preventive Maintenance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Task</th>
                  <th className="px-5 py-2.5 text-left font-medium">Next Due</th>
                  <th className="px-5 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {otherTasks.map((t: any) => {
                  const isOverdue = t.next_due_date && t.next_due_date < today
                  return (
                    <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-5 py-3 font-medium text-gray-900">{t.task_name}</td>
                      <td className={`px-5 py-3 text-[13px] tabular-nums ${isOverdue ? 'font-medium text-red-700' : 'text-gray-700'}`}>{date(t.next_due_date)}</td>
                      <td className="px-5 py-3"><StatusChip tone={isOverdue ? 'danger' : 'success'}>{isOverdue ? 'Overdue' : 'Scheduled'}</StatusChip></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
