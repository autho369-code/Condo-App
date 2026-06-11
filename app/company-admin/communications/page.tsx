import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { Badge } from '@/components/ui/shell'
import { StatusChip } from '@/components/operations/status-chip'
import { Mail, MessageSquare, AlertTriangle, Phone } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
}) {
  return (
    <div className={`${card} px-4 py-3.5`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">{children}</th>
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
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Communications</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Communication volume monitoring for {me.portfolio?.company_name ?? me.portfolio?.name ?? 'your portfolio'}
        </p>
        {tableEmpty && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 ring-1 ring-inset ring-blue-600/15">
            Communication tracking is active — no data recorded yet this month.
          </div>
        )}
      </div>

      {/* ── Stats Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Emails Sent (MTD)" value={emailsSent} sub={`${totalRecipients} total recipients`} icon={Mail} />
        <StatCard label="SMS Sent (MTD)" value={smsSent} icon={MessageSquare} />
        <StatCard label="Phone Calls (MTD)" value={phoneCalls} icon={Phone} />
        <StatCard label="Failed Emails" value={failedEmails} sub={emailsSent > 0 ? `${((failedEmails / emailsSent) * 100).toFixed(1)}% failure` : '0%'} icon={AlertTriangle} />
        <StatCard label="Failed SMS" value={failedSms} sub={smsSent > 0 ? `${((failedSms / smsSent) * 100).toFixed(1)}% failure` : '0%'} icon={AlertTriangle} />
      </div>

      {/* ── By Association / By Manager ──────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* By Association */}
        <div className={card}>
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-950">By Association</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/60">
                <tr>
                  <Th>Association</Th>
                  <Th>Emails</Th>
                  <Th>SMS</Th>
                  <Th>Phone</Th>
                  <Th>Total</Th>
                </tr>
              </thead>
              <tbody>
                {assocCommList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                      {tableEmpty ? 'No communications recorded this month.' : 'No associations match.'}
                    </td>
                  </tr>
                ) : (
                  assocCommList.map((a) => (
                    <tr key={a.name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <Td className="font-medium text-gray-900">{a.name}</Td>
                      <Td className="tabular-nums text-gray-700">{a.emails > 0 ? a.emails : '—'}</Td>
                      <Td className="tabular-nums text-gray-700">{a.sms > 0 ? a.sms : '—'}</Td>
                      <Td className="tabular-nums text-gray-700">{a.phone > 0 ? a.phone : '—'}</Td>
                      <Td className="font-medium tabular-nums text-gray-950">{a.total > 0 ? a.total : '—'}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* By Manager */}
        <div className={card}>
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-950">By Manager</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/60">
                <tr>
                  <Th>Manager</Th>
                  <Th>Emails</Th>
                  <Th>SMS</Th>
                  <Th>Phone</Th>
                  <Th>Total</Th>
                </tr>
              </thead>
              <tbody>
                {mgrCommList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                      {tableEmpty ? 'No communications recorded this month.' : 'No managers match.'}
                    </td>
                  </tr>
                ) : (
                  mgrCommList.map((m) => (
                    <tr key={m.name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <Td className="font-medium text-gray-900">{m.name}</Td>
                      <Td className="tabular-nums text-gray-700">{m.emails > 0 ? m.emails : '—'}</Td>
                      <Td className="tabular-nums text-gray-700">{m.sms > 0 ? m.sms : '—'}</Td>
                      <Td className="tabular-nums text-gray-700">{m.phone > 0 ? m.phone : '—'}</Td>
                      <Td className="font-medium tabular-nums text-gray-950">{m.total > 0 ? m.total : '—'}</Td>
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
        <div className={card}>
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-950">Recent Communications</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/60">
                <tr>
                  <Th>Date</Th>
                  <Th>Channel</Th>
                  <Th>Direction</Th>
                  <Th>Subject</Th>
                  <Th>Recipients</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {monthComms.slice(0, 50).map((c: any) => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <Td className="whitespace-nowrap tabular-nums text-gray-700">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </Td>
                    <Td>
                      <StatusChip tone={c.channel === 'email' ? 'info' : c.channel === 'sms' ? 'success' : 'neutral'}>
                        {c.channel}
                      </StatusChip>
                    </Td>
                    <Td className="capitalize text-gray-700">{c.direction ?? '—'}</Td>
                    <Td className="max-w-xs truncate text-gray-900">{c.subject ?? '—'}</Td>
                    <Td className="tabular-nums text-gray-700">{c.recipient_count ?? 0}</Td>
                    <Td><Badge status={c.status ?? 'unknown'} /></Td>
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
