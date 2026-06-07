import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
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

  const statusB = (s: string) => {
    const m: Record<string, string> = { sent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', failed: 'bg-red-500/10 text-red-400 border-red-500/20', pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
    return m[s] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Communications</h1>
        <p className="mt-1 text-sm text-slate-400">Email, SMS, and announcement activity for your association</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Emails Sent (MTD)', value: emailsSent, cls: 'text-white' },
          { label: 'SMS Sent (MTD)', value: smsSent, cls: 'text-white' },
          { label: 'Announcements', value: announcements, cls: 'text-white' },
          { label: 'Failed', value: failed, cls: failed > 0 ? 'text-red-400' : 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
            <div className="text-xs font-medium uppercase text-slate-500">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#1E293B] overflow-hidden" style={{ backgroundColor: '#0B1121' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Channel</th>
              <th className="px-4 py-3 text-left font-medium">Subject</th>
              <th className="px-4 py-3 text-right font-medium">Recipients</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">No communications recorded yet for your association.</td></tr>
            ) : (
              logs.map((l: any) => (
                <tr key={l.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-slate-400 tabular-nums">{date(l.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full border border-[#1E293B] px-2 py-0.5 text-xs text-slate-400 capitalize">{l.channel ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{l.subject ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">{l.recipient_count ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusB(l.status)}`}>{l.status ?? '—'}</span>
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
