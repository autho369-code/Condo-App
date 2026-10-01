import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { ScrollText, User } from 'lucide-react'
import { Alert } from '@/components/ui/shell'
import { displayTimeZone } from '@/lib/time/display-zone'
import { formatInZone, zonedWallTimeToUtc } from '@/lib/time/zoned'

export const dynamic = 'force-dynamic'

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const sp = await searchParams

  // ── Fetch audit logs ────────────────────────────────
  // The date filters are calendar days in the company's time zone.
  const zone = displayTimeZone()
  const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  let query = db
    .from('audit_logs')
    .select('id, created_at, action, entity_type, entity_id, actor_id, actor_email, changes')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false })
    .limit(500)
  if (isDay(sp.from)) {
    const start = zonedWallTimeToUtc(sp.from!, '00:00', zone)
    if (start) query = query.gte('created_at', start.toISOString())
  }
  if (isDay(sp.to)) {
    const [y, m, d] = sp.to!.split('-').map(Number)
    const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
    const end = zonedWallTimeToUtc(next, '00:00', zone)
    if (end) query = query.lt('created_at', end.toISOString())
  }
  const { data, error: logError } = await query
  const logRows: any[] = data ?? []

  const inputCls = 'mt-1 block h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Audit Logs</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Track changes across {me.portfolio?.company_name ?? me.portfolio?.name ?? 'your portfolio'}
        </p>
      </div>

      {logError && <Alert title="Could not load the audit log">{logError.message}</Alert>}

      {/* Date Range Filter */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <form action="/company-admin/audit-logs" method="get" className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-500">From</span>
            <input type="date" name="from" defaultValue={sp.from ?? ''} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">To</span>
            <input type="date" name="to" defaultValue={sp.to ?? ''} className={inputCls} />
          </label>
          <button
            type="submit"
            className="h-10 rounded-xl bg-gray-950 px-4 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Filter
          </button>
          {(sp.from || sp.to) && (
            <a
              href="/company-admin/audit-logs"
              className="inline-flex h-10 items-center rounded-xl border border-gray-200 px-3 text-sm text-gray-500 transition hover:text-gray-950"
            >
              Clear
            </a>
          )}
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-950">
              {logRows.length > 0 ? `${logRows.length} log entries` : 'Audit Trail'}
            </h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <Th>Date / Time</Th>
                <Th>User</Th>
                <Th>Action</Th>
                <Th>Record Type</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {logRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <ScrollText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                    <div className="text-sm font-semibold text-gray-900">No audit log entries found for the selected period.</div>
                    <div className="mt-1 text-sm text-gray-500">Audit trail entries will appear here as actions are performed.</div>
                  </td>
                </tr>
              ) : (
                logRows.map((row: any) => (
                  <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <Td className="whitespace-nowrap font-mono text-xs text-gray-500">
                      {row.created_at
                        ? formatInZone(row.created_at, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }, zone)
                        : '—'}
                    </Td>
                    <Td className="text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3 w-3 text-gray-400" />
                        {row.actor_email || (row.actor_id ? 'Unknown user' : 'System')}
                      </span>
                    </Td>
                    <Td>
                      <span className="inline-flex h-6 items-center rounded-full bg-gray-100 px-2.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/15">
                        {row.action ? String(row.action).replace(/_/g, ' ') : '—'}
                      </span>
                    </Td>
                    <Td className="text-gray-700">{row.entity_type ? String(row.entity_type).replace(/_/g, ' ') : '—'}</Td>
                    <Td className="max-w-xs truncate text-gray-500">
                      {row.changes ? JSON.stringify(row.changes).slice(0, 100) : '—'}
                    </Td>
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
