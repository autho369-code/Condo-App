import { createClient } from '@/lib/supabase/server'
import { StatTile } from '@/components/ui/stat-tile'
import { requirePlatformOperator } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
import { formatInZone } from '@/lib/time/zoned'
import { MailCheck, MailWarning, Webhook, Database, Inbox, Clock } from 'lucide-react'
import { healthProblems, type PlatformHealthSummary } from '@/lib/platform/health'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

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
    { data: healthData, error: healthError },
  ] = await Promise.all([
    db.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', d1),
    db.from('email_queue').select('id, to_email, subject, error_message, created_at').eq('status', 'failed').gte('created_at', d7).order('created_at', { ascending: false }).limit(25),
    db.from('webhook_endpoints').select('id, name, url, active, failure_count, last_success_at, last_failure_at, last_failure_message, portfolios(company_name)').order('created_at'),
    db.from('webhook_deliveries').select('id, event_type, status, attempts, response_code, error_message, created_at').neq('status', 'succeeded').gte('created_at', d7).order('created_at', { ascending: false }).limit(25),
    db.from('portfolios').select('id', { count: 'exact', head: true }),
    db.rpc('platform_health_summary', { p_hours: 168 }),
  ])
  const health = (healthData ?? null) as PlatformHealthSummary | null
  const jobFailures = health?.cron_failures ?? []
  const problems = health ? healthProblems(health) : []

  const dbHealthy = !dbCheck.error
  const failing = (endpoints ?? []).filter((e: any) => e.active && (e.failure_count ?? 0) > 0)

  const statTiles = [
    { label: 'Database', value: dbHealthy ? 'Reachable' : 'ERROR', icon: Database, bad: !dbHealthy },
    { label: 'Emails Pending', value: pendingEmails ?? 0, icon: Inbox, bad: (pendingEmails ?? 0) > 25 },
    { label: 'Emails Sent (24h)', value: sent24h ?? 0, icon: MailCheck, bad: false },
    { label: 'Email Failures (7d)', value: (failedEmails ?? []).length, icon: MailWarning, bad: (failedEmails ?? []).length > 0 },
    { label: 'Failing Webhooks', value: failing.length, icon: Webhook, bad: failing.length > 0 },
    { label: 'Job Failures (7d)', value: healthError ? '—' : jobFailures.length, icon: Clock, bad: !!healthError || jobFailures.length > 0 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">System Monitor</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">
          Delivery infrastructure health — email queue, webhooks, scheduled jobs and database reachability, measured live.
          The platform operator is emailed each morning when anything failed in the last 24 hours.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {statTiles.map((t) => {
          const Icon = t.icon
          return (
            <StatTile key={t.label} label={t.label} value={t.value} icon={Icon} tone={t.bad ? 'danger' : 'default'} />
          )
        })}
      </div>

      {/* ── Last 7 days summary + scheduled job failures ── */}
      <div className={card}>
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Scheduled Job Failures (last 7 days)</h2>
          <p className="mt-0.5 text-[13px] text-gray-500">
            {healthError
              ? 'The health summary could not be read.'
              : problems.length === 0
                ? 'No failures in the last 7 days across scheduled jobs, email, webhooks, reports, automations and payments.'
                : problems.join(' · ')}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Job</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Error</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {jobFailures.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-sm text-gray-500">{healthError ? 'Could not load scheduled job failures.' : 'No failed scheduled jobs in the last 7 days.'}</td></tr>
              ) : (
                jobFailures.map((f, i) => (
                  <tr key={`${f.job}-${f.started_at}-${i}`} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                    <td className="px-5 py-3 font-medium text-gray-900">{f.job}</td>
                    <td className="max-w-sm truncate px-5 py-3 text-[13px] text-red-700">{f.message || '—'}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-sm tabular-nums text-gray-700">{formatInZone(f.started_at, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Email failures ────────────────────────────── */}
      <div className={card}>
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Email Failures (last 7 days)</h2>
          <p className="mt-0.5 text-[13px] text-gray-500">Messages Resend could not deliver — investigate the address or the error</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Recipient</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Subject</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Error</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {(failedEmails ?? []).length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">No failed emails in the last 7 days.</td></tr>
              ) : (
                (failedEmails ?? []).map((e: any) => (
                  <tr key={e.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                    <td className="px-5 py-3 font-medium text-gray-900">{e.to_email}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-[13px] text-gray-700">{e.subject}</td>
                    <td className="max-w-sm truncate px-5 py-3 text-[13px] text-red-700">{e.error_message ?? '—'}</td>
                    <td className="px-5 py-3.5 text-sm tabular-nums text-gray-700">{date(e.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Webhook endpoints ─────────────────────────── */}
      <div className={card}>
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Webhook Endpoints</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Endpoint</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Company</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Last Success</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Failures</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(endpoints ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">No webhook endpoints configured.</td></tr>
              ) : (
                (endpoints ?? []).map((e: any) => (
                  <tr key={e.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-900">{e.name}</div>
                      <div className="max-w-xs truncate text-xs text-gray-500">{e.url}</div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-700">{e.portfolios?.company_name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-sm tabular-nums text-gray-700">{e.last_success_at ? date(e.last_success_at) : 'Never'}</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${(e.failure_count ?? 0) > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>{e.failure_count ?? 0}</td>
                    <td className="px-5 py-3.5">
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
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Unsuccessful Webhook Deliveries (last 7 days)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Event</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Attempts</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Response</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">Error</th>
                <th className="whitespace-nowrap px-5 py-3 text-left font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {(failedDeliveries ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">No failed deliveries in the last 7 days.</td></tr>
              ) : (
                (failedDeliveries ?? []).map((d: any) => (
                  <tr key={d.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                    <td className="px-5 py-3 font-medium text-gray-900">{d.event_type}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-gray-700">{d.attempts ?? 0}</td>
                    <td className="px-5 py-3.5 text-sm tabular-nums text-gray-700">{d.response_code ?? '—'}</td>
                    <td className="max-w-sm truncate px-5 py-3 text-[13px] text-red-700">{d.error_message ?? '—'}</td>
                    <td className="px-5 py-3.5 text-sm tabular-nums text-gray-700">{date(d.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs leading-5 text-gray-400">
        Application uptime, API latency, and function logs live in the Vercel and Supabase dashboards — this page
        covers the infrastructure the platform manages itself (email queue, webhooks, scheduled database jobs, database reachability).
      </p>
    </div>
  )
}
