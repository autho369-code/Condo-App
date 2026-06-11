import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { Badge } from '@/components/ui/shell'
import { date } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function BoardCommunicationsPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  let logs: any[] = []
  try {
    const { data } = await db
      .from('communications_log')
      .select('*')
      .in('association_id', ids)
      .order('created_at', { ascending: false })
      .limit(100)
    logs = data ?? []
  } catch { }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const mtd = logs.filter((l: any) => l.created_at >= monthStart)
  const emailsSent = mtd.filter((l: any) => l.channel === 'email' && l.status === 'sent').length
  const smsSent = mtd.filter((l: any) => l.channel === 'sms' && l.status === 'sent').length
  const failed = mtd.filter((l: any) => l.status === 'failed').length
  const announcements = mtd.filter((l: any) => l.channel === 'announcement').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Communications</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Email, SMS, and announcement activity for your association</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Emails Sent (MTD)', value: emailsSent },
          { label: 'SMS Sent (MTD)', value: smsSent },
          { label: 'Announcements', value: announcements },
          { label: 'Failed', value: failed },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{s.label}</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Date</th>
              <th className="px-4 py-2.5 text-left font-medium">Channel</th>
              <th className="px-4 py-2.5 text-left font-medium">Subject</th>
              <th className="px-4 py-2.5 text-right font-medium">Recipients</th>
              <th className="px-4 py-2.5 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">No communications recorded yet for your association.</td></tr>
            ) : (
              logs.map((l: any) => (
                <tr key={l.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3 text-[13px] tabular-nums text-gray-700">{date(l.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium capitalize text-gray-600 ring-1 ring-inset ring-gray-500/15">{l.channel ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-700">{l.subject ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-[13px] tabular-nums text-gray-700">{l.recipient_count ?? 0}</td>
                  <td className="px-4 py-3 text-center"><Badge status={l.status ?? 'na'} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
