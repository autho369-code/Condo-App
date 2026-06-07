import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { Mail, MessageSquare, AlertTriangle, Phone, User } from 'lucide-react'

export const dynamic = 'force-dynamic'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'emerald',
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'violet'
}) {
  const accents: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  }
  return (
    <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>
}

export default async function CommunicationsPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // ── Fetch communications log ────────────────────────
  let commRows: any[] = []
  try {
    const { data } = await db
      .from('communications_log')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('created_at', { ascending: false })
      .limit(1000)
    commRows = data ?? []
  } catch {
    commRows = []
  }

  // Current month only
  const monthComms = commRows.filter((c: any) => c.created_at && c.created_at >= monthStart)

  // Stats by channel
  const emailsSent = monthComms.filter((c: any) => c.channel === 'email').length
  const smsSent = monthComms.filter((c: any) => c.channel === 'sms').length
  const phoneCalls = monthComms.filter((c: any) => c.channel === 'phone').length
  const failedEmails = monthComms.filter((c: any) => c.channel === 'email' && c.status === 'failed').length
  const failedSms = monthComms.filter((c: any) => c.channel === 'sms' && c.status === 'failed').length
  const totalRecipients = monthComms.reduce((sum: number, c: any) => sum + (c.recipient_count ?? 0), 0)

  // Fetch associations and profiles for grouping
  const [{ data: associations }, { data: managers }] = await Promise.all([
    db.from('associations').select('id, name').eq('portfolio_id', portfolioId).is('archived_at', null).order('name'),
    db.from('profiles').select('id, full_name').eq('portfolio_id', portfolioId).in('hoa_role', ['manager', 'company_admin']).order('full_name'),
  ])

  // By association: group comms by association_id
  const assocCommMap = new Map<string, { name: string; emails: number; sms: number; phone: number; total: number }>()
  for (const a of associations ?? []) {
    assocCommMap.set(a.id, { name: a.name, emails: 0, sms: 0, phone: 0, total: 0 })
  }
  for (const c of monthComms) {
    if (!c.association_id) continue
    const entry = assocCommMap.get(c.association_id)
    if (!entry) continue
    if (c.channel === 'email') entry.emails++
    else if (c.channel === 'sms') entry.sms++
    else if (c.channel === 'phone') entry.phone++
    entry.total++
  }
  const assocCommList = Array.from(assocCommMap.values()).sort((a, b) => b.total - a.total)

  // By manager: group by a manager_id field if it exists
  // communications_log may have sender_user_id or created_by
  const mgrCommMap = new Map<string, { name: string; emails: number; sms: number; phone: number; total: number }>()
  for (const m of managers ?? []) {
    mgrCommMap.set(m.id, { name: m.full_name ?? m.id, emails: 0, sms: 0, phone: 0, total: 0 })
  }
  for (const c of monthComms) {
    const uid = c.sender_user_id ?? c.created_by
    if (!uid) continue
    const entry = mgrCommMap.get(uid)
    if (!entry) continue
    if (c.channel === 'email') entry.emails++
    else if (c.channel === 'sms') entry.sms++
    else if (c.channel === 'phone') entry.phone++
    entry.total++
  }
  const mgrCommList = Array.from(mgrCommMap.values()).sort((a, b) => b.total - a.total)

  const tableEmpty = monthComms.length === 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Communications</h1>
        <p className="mt-1 text-sm text-slate-400">
          Communication volume monitoring for {me.portfolio?.company_name ?? me.portfolio?.name ?? 'your portfolio'}
        </p>
        {tableEmpty && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-400 ring-1 ring-blue-500/20">
            Communication tracking is active — no data recorded yet this month.
          </div>
        )}
      </div>

      {/* ── Stats Cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Emails Sent (MTD)" value={emailsSent} sub={`${totalRecipients} total recipients`} icon={Mail} accent="blue" />
        <StatCard label="SMS Sent (MTD)" value={smsSent} icon={MessageSquare} accent="emerald" />
        <StatCard label="Phone Calls (MTD)" value={phoneCalls} icon={Phone} accent="violet" />
        <StatCard label="Failed Emails" value={failedEmails} sub={emailsSent > 0 ? `${((failedEmails / emailsSent) * 100).toFixed(1)}% failure` : '0%'} icon={AlertTriangle} accent={failedEmails > 0 ? 'red' : 'emerald'} />
        <StatCard label="Failed SMS" value={failedSms} sub={smsSent > 0 ? `${((failedSms / smsSent) * 100).toFixed(1)}% failure` : '0%'} icon={AlertTriangle} accent={failedSms > 0 ? 'red' : 'emerald'} />
      </div>

      {/* ── By Association / By Manager ──────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By Association */}
        <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
          <div className="border-b border-[#1E293B] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">By Association</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  <Th>Association</Th>
                  <Th>Emails</Th>
                  <Th>SMS</Th>
                  <Th>Phone</Th>
                  <Th>Total</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {assocCommList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      {tableEmpty ? 'No communications recorded this month.' : 'No associations match.'}
                    </td>
                  </tr>
                ) : (
                  assocCommList.map((a) => (
                    <tr key={a.name} className="hover:bg-white/[0.02]">
                      <Td className="font-medium text-slate-200">{a.name}</Td>
                      <Td className="tabular-nums text-slate-300">{a.emails > 0 ? a.emails : '—'}</Td>
                      <Td className="tabular-nums text-slate-300">{a.sms > 0 ? a.sms : '—'}</Td>
                      <Td className="tabular-nums text-slate-300">{a.phone > 0 ? a.phone : '—'}</Td>
                      <Td className="tabular-nums font-medium text-white">{a.total > 0 ? a.total : '—'}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* By Manager */}
        <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
          <div className="border-b border-[#1E293B] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">By Manager</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  <Th>Manager</Th>
                  <Th>Emails</Th>
                  <Th>SMS</Th>
                  <Th>Phone</Th>
                  <Th>Total</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {mgrCommList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      {tableEmpty ? 'No communications recorded this month.' : 'No managers match.'}
                    </td>
                  </tr>
                ) : (
                  mgrCommList.map((m) => (
                    <tr key={m.name} className="hover:bg-white/[0.02]">
                      <Td className="font-medium text-slate-200">{m.name}</Td>
                      <Td className="tabular-nums text-slate-300">{m.emails > 0 ? m.emails : '—'}</Td>
                      <Td className="tabular-nums text-slate-300">{m.sms > 0 ? m.sms : '—'}</Td>
                      <Td className="tabular-nums text-slate-300">{m.phone > 0 ? m.phone : '—'}</Td>
                      <Td className="tabular-nums font-medium text-white">{m.total > 0 ? m.total : '—'}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Recent Activity Feed ─────────────────────── */}
      {monthComms.length > 0 && (
        <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
          <div className="border-b border-[#1E293B] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Recent Communications</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  <Th>Date</Th>
                  <Th>Channel</Th>
                  <Th>Direction</Th>
                  <Th>Subject</Th>
                  <Th>Recipients</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {monthComms.slice(0, 50).map((c: any) => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <Td className="whitespace-nowrap text-slate-400">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </Td>
                    <Td>
                      <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${
                        c.channel === 'email' ? 'bg-blue-500/10 text-blue-400 ring-blue-500/20' :
                        c.channel === 'sms' ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' :
                        'bg-violet-500/10 text-violet-400 ring-violet-500/20'
                      }`}>
                        {c.channel}
                      </span>
                    </Td>
                    <Td className="text-slate-400">{c.direction ?? '—'}</Td>
                    <Td className="max-w-xs truncate text-slate-300">{c.subject ?? '—'}</Td>
                    <Td className="tabular-nums text-slate-400">{c.recipient_count ?? 0}</Td>
                    <Td>
                      <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${
                        c.status === 'sent' || c.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' :
                        c.status === 'failed' ? 'bg-red-500/10 text-red-400 ring-red-500/20' :
                        'bg-slate-500/10 text-slate-400 ring-slate-500/20'
                      }`}>
                        {c.status ?? 'unknown'}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
