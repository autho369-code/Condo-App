import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
import { CalendarClock, Wrench, AlertTriangle } from 'lucide-react'
import { addDaysToDate, todayInZone } from '@/lib/time/zoned'
import { Alert } from '@/components/ui/shell'
import { collectLoadErrors } from '@/lib/company-admin/load-errors'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

export default async function CompanyMaintenanceCalendarPage() {
  const me = await requirePortfolioAdmin()
  const portfolioId = me.portfolio?.id
  const supabase = await createClient()
  const db = supabase as any
  // Calendar dates are the company's zone (server code runs in UTC).
  const today = todayInZone()
  const in90 = addDaysToDate(today, 90)

  const [upcomingRes, inspectionsRes] = await Promise.all([
    // v_upcoming_maintenance is portfolio-scoped by can_access_portfolio inside the view.
    db.from('v_upcoming_maintenance').select('*').lte('next_due_date', in90),
    db.from('inspections')
      .select('id, inspection_type, scheduled_date, status, associations(name)')
      .eq('portfolio_id', portfolioId)
      .is('archived_at', null)
      .is('completed_date', null)
      // Cancelled inspections are not "due"; inspection_status is
      // scheduled | in_progress | completed | cancelled.
      .in('status', ['scheduled', 'in_progress'])
      .lte('scheduled_date', in90)
      .order('scheduled_date'),
  ])

  const upcoming = upcomingRes.data as any[] | null
  const inspections = inspectionsRes.data as any[] | null
  const loadErrors = collectLoadErrors({ 'Preventive maintenance': upcomingRes, Inspections: inspectionsRes })

  const overdue = (upcoming ?? []).filter((t: any) => t.next_due_date && t.next_due_date < today)
  const dueSoon = (upcoming ?? []).filter((t: any) => !t.next_due_date || t.next_due_date >= today)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Maintenance Calendar</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">
          Company-wide preventive maintenance and inspections due in the next 90 days
        </p>
      </div>

      {loadErrors.length > 0 && <Alert tone="danger" title="Some maintenance data could not be loaded.">{loadErrors.join(' · ')}</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          { label: 'Overdue Tasks', value: overdue.length, icon: AlertTriangle, warn: overdue.length > 0 },
          { label: 'Due in 90 Days', value: dueSoon.length, icon: CalendarClock, warn: false },
          { label: 'Open Inspections', value: (inspections ?? []).length, icon: Wrench, warn: false },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className={`${card} px-4 py-3.5`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[13px] font-medium text-gray-500">{item.label}</div>
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
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Upcoming Preventive Maintenance</h2>
          <p className="mt-0.5 text-[13px] text-gray-500">Elevator, fire alarm, HVAC, landscaping, and every other scheduled task across all associations</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Task</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Association</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Category</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Vendor</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Next Due</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(upcoming ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">
                    No preventive maintenance tasks scheduled in the next 90 days. Managers add them under{' '}
                    <Link href="/maintenance" className="font-medium text-gray-700 underline">Maintenance → Preventive</Link>.
                  </td>
                </tr>
              ) : (
                (upcoming ?? []).map((t: any) => {
                  const isOverdue = t.next_due_date && t.next_due_date < today
                  return (
                    <tr key={t.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                      <td className="px-5 py-3 font-medium text-gray-900">{t.task_name}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-700">{t.association_name ?? '—'}</td>
                      <td className="px-5 py-3 text-[13px] capitalize text-gray-700">{(t.category ?? '—').replace(/_/g, ' ')}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-700">{t.vendor_name ?? '—'}</td>
                      <td className={`px-5 py-3 text-[13px] tabular-nums ${isOverdue ? 'font-medium text-red-700' : 'text-gray-700'}`}>{date(t.next_due_date)}</td>
                      <td className="px-5 py-3.5"><StatusChip tone={isOverdue ? 'danger' : 'success'}>{isOverdue ? 'Overdue' : 'Scheduled'}</StatusChip></td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={card}>
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Open Inspections</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Inspection</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Association</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Scheduled</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(inspections ?? []).length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">No open inspections in the next 90 days.</td></tr>
              ) : (
                (inspections ?? []).map((i: any) => (
                  <tr key={i.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                    <td className="px-5 py-3 font-medium capitalize text-gray-900">{(i.inspection_type ?? 'Inspection').replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-700">{i.associations?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-sm tabular-nums text-gray-700">{date(i.scheduled_date)}</td>
                    <td className="px-5 py-3.5"><StatusChip tone="info">{(i.status ?? 'scheduled').replace(/_/g, ' ')}</StatusChip></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
