import { createClient } from '@/lib/supabase/server'
import { requirePlatformOperator } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
import { MailCheck, MailWarning, Webhook, Database, Inbox } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

export default async function SystemMonitorPage() {
  await requirePlatformOperator()
  const supabase = await createClient()
  const db = supabase as any
  const d1 = new Date(Date.now() - 24 * 3600000).toISOString()
  const d7 = new Date(Date.now() - 7 * 86400000).toISOString()

  const [
    { count: pendingEmails },
    { count: sent24h },
    { data: failedEmails },
    { data: endpoints },
    { data: failedDeliveries },
    dbCheck,
  ] = await Promise.all([
    db.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', d1),
    db.from('email_queue').select('id, to_email, subject, error_message, created_at').eq('status', 'failed').gte('created_at', d7).order('created_at', { ascending: false }).limit(25),
    db.from('webhook_endpoints').select('id, name, url, active, failure_count, last_success_at, last_failure_at, last_failure_message, portfolios(company_name)').order('created_at'),
    db.from('webhook_deliveries').select('id, event_type, status, attempts, response_code, error_message, created_at').neq('status', 'succeeded').gte('created_at', d7).order('created_at', { ascending: false }).limit(25),
    db.from('portfolios').select('id', { count: 'exact', head: true }),
  ])

  const dbHealthy = !dbCheck.error
  const failing = (endpoints ?? []).filter((e: any) => e.active && (e.failure_count ?? 0) > 0)

  const statTiles = [
    { label: 'Database', value: dbHealthy ? 'Reachable' : 'ERROR', icon: Database, bad: !dbHealthy },
    { label: 'Emails Pending', value: pendingEmails ?? 0, icon: Inbox, bad: (pendingEmails ?? 0) > 25 },
    { label: 'Emails Sent (24h)', value: sent24h ?? 0, icon: MailCheck, bad: false },
    { label: 'Email Failures (7d)', value: (failedEmails ?? []).length, icon: MailWarning, bad: (failedEmails ?? []).length > 0 },
    { label: 'Failing Webhooks', value: failing.length, icon: Webhook, bad: failing.length > 0 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">System Monitor</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Delivery infrastructure health — email queue, webhooks, and database reachability, measured live
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {statTiles.map((t) => {
          const Icon = t.icon
          return (
            <div key={t.label} className={`${card} px-4 py-3.5`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{t.label}</div>
                  <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${t.bad ? 'text-red-700' : 'text-gray-950'}`}>{t.value}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Icon className="h-4.5 w-4.5 text-gray-400" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Email failures ────────────────────────────── */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Email Failures (last 7 days)</h2>
          <p className="mt-0.5 text-xs text-gray-500">Messages Resend could not deliver — investigate the address or the error</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Recipient</th>
                <th className="px-5 py-2.5 text-left font-medium">Subject</th>
                <th className="px-5 py-2.5 text-left font-medium">Error</th>
                <th className="px-5 py-2.5 text-left font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {(failedEmails ?? []).length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">No failed emails in the last 7 days.</td></tr>
              ) : (
                (failedEmails ?? []).map((e: any) => (
                  <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-900">{e.to_email}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-[13px] text-gray-700">{e.subject}</td>
                    <td className="max-w-sm truncate px-5 py-3 text-[13px] text-red-700">{e.error_message ?? '—'}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(e.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Webhook endpoints ─────────────────────────── */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Webhook Endpoints</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Endpoint</th>
                <th className="px-5 py-2.5 text-left font-medium">Company</th>
                <th className="px-5 py-2.5 text-left font-medium">Last Success</th>
                <th className="px-5 py-2.5 text-right font-medium">Failures</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(endpoints ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">No webhook endpoints configured.</td></tr>
              ) : (
                (endpoints ?? []).map((e: any) => (
                  <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{e.name}</div>
                      <div className="max-w-xs truncate text-xs text-gray-500">{e.url}</div>
                    </td>
                    <td className="px-5 py-3 text-[13px] text-gray-700">{e.portfolios?.company_name ?? '—'}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{e.last_success_at ? date(e.last_success_at) : 'Never'}</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${(e.failure_count ?? 0) > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>{e.failure_count ?? 0}</td>
                    <td className="px-5 py-3">
                      <StatusChip tone={!e.active ? 'neutral' : (e.failure_count ?? 0) > 0 ? 'danger' : 'success'}>
                        {!e.active ? 'Disabled' : (e.failure_count ?? 0) > 0 ? 'Failing' : 'Healthy'}
                      </StatusChip>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Failed webhook deliveries ─────────────────── */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Unsuccessful Webhook Deliveries (last 7 days)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Event</th>
                <th className="px-5 py-2.5 text-right font-medium">Attempts</th>
                <th className="px-5 py-2.5 text-left font-medium">Response</th>
                <th className="px-5 py-2.5 text-left font-medium">Error</th>
                <th className="px-5 py-2.5 text-left font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {(failedDeliveries ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">No failed deliveries in the last 7 days.</td></tr>
              ) : (
                (failedDeliveries ?? []).map((d: any) => (
                  <tr key={d.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-900">{d.event_type}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{d.attempts ?? 0}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{d.response_code ?? '—'}</td>
                    <td className="max-w-sm truncate px-5 py-3 text-[13px] text-red-700">{d.error_message ?? '—'}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(d.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs leading-5 text-gray-400">
        Application uptime, API latency, and function logs live in the Vercel and Supabase dashboards — this page
        covers the delivery infrastructure the platform manages itself (email queue, webhooks, database reachability).
      </p>
    </div>
  )
}
