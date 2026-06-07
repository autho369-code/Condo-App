import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { ScrollText, Search, Calendar, User, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{children}</th>
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
  let logRows: any[] = []
  let tableExists = true

  try {
    let query = db
      .from('audit_logs')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (sp.from) {
      query = query.gte('created_at', sp.from)
    }
    if (sp.to) {
      const toDate = new Date(sp.to)
      toDate.setDate(toDate.getDate() + 1) // include full day
      query = query.lt('created_at', toDate.toISOString().slice(0, 10))
    }

    const { data } = await query
    logRows = data ?? []
  } catch {
    logRows = []
    tableExists = false
  }

  // Deduced columns from row data
  const hasUser = logRows.length > 0 && (logRows[0].user_id || logRows[0].actor_user_id || logRows[0].performed_by)
  const hasAction = logRows.length > 0 && (logRows[0].action || logRows[0].event)
  const hasRecordType = logRows.length > 0 && (logRows[0].record_type || logRows[0].entity_type || logRows[0].table_name)
  const hasDetails = logRows.length > 0 && (logRows[0].details || logRows[0].metadata || logRows[0].changes)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-400">
          Track changes across {me.portfolio?.company_name ?? me.portfolio?.name ?? 'your portfolio'}
        </p>
      </div>

      {/* Date Range Filter */}
      <div className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
        <form action="/company-admin/audit-logs" method="get" className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">From</span>
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ''}
              className="mt-1 block h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              style={{ colorScheme: 'dark' }}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">To</span>
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ''}
              className="mt-1 block h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              style={{ colorScheme: 'dark' }}
            />
          </label>
          <button
            type="submit"
            className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Filter
          </button>
          {(sp.from || sp.to) && (
            <a
              href="/company-admin/audit-logs"
              className="inline-flex items-center h-9 rounded-lg border border-[#1E293B] px-3 text-sm text-slate-400 hover:text-white"
            >
              Clear
            </a>
          )}
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <div className="border-b border-[#1E293B] px-5 py-4">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-white">
              {logRows.length > 0 ? `${logRows.length} log entries` : 'Audit Trail'}
            </h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E293B]">
                <Th>Date / Time</Th>
                {hasUser && <Th>User</Th>}
                {hasAction && <Th>Action</Th>}
                {hasRecordType && <Th>Record Type</Th>}
                {hasDetails && <Th>Details</Th>}
                {!hasAction && !hasUser && <Th>Entry</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {logRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <ScrollText className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                    <div className="text-sm text-slate-400">
                      {tableExists ? 'No audit log entries found for the selected period.' : 'No audit logs recorded yet.'}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {tableExists
                        ? 'Audit trail entries will appear here as actions are performed.'
                        : 'The audit_logs table is ready. Logs will appear here once actions are tracked.'
                      }
                    </div>
                  </td>
                </tr>
              ) : (
                logRows.map((row: any, idx: number) => {
                  const userId = row.user_id || row.actor_user_id || row.performed_by
                  const action = row.action || row.event
                  const recordType = row.record_type || row.entity_type || row.table_name
                  const details = row.details || row.metadata || row.changes
                  return (
                    <tr key={row.id ?? idx} className="hover:bg-white/[0.02]">
                      <Td className="whitespace-nowrap text-slate-400 font-mono text-xs">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : '—'}
                      </Td>
                      {hasUser && (
                        <Td className="text-slate-300">
                          <span className="inline-flex items-center gap-1.5">
                            <User className="h-3 w-3 text-slate-500" />
                            {typeof userId === 'string' ? userId.slice(0, 12) + '...' : '—'}
                          </span>
                        </Td>
                      )}
                      {hasAction && (
                        <Td>
                          <span className="inline-flex h-6 items-center rounded-full bg-slate-500/10 px-2.5 text-xs font-medium text-slate-300 ring-1 ring-slate-500/20">
                            {action ?? '—'}
                          </span>
                        </Td>
                      )}
                      {hasRecordType && (
                        <Td className="text-slate-400">{recordType ?? '—'}</Td>
                      )}
                      {hasDetails && (
                        <Td className="max-w-xs truncate text-slate-400">
                          {typeof details === 'object' ? JSON.stringify(details).slice(0, 100) : (details ?? '—')}
                        </Td>
                      )}
                      {!hasAction && !hasUser && (
                        <Td className="max-w-lg truncate text-slate-400 font-mono text-xs">
                          {JSON.stringify(row).slice(0, 200)}
                        </Td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!tableExists && (
        <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">Schema Note</span>
          </div>
          <p className="text-sm text-slate-400">
            The audit_logs table may need to be created in your database. Suggested columns:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-[#1E293B] bg-[#060B18] p-3 text-xs text-slate-400">
{`-- Run in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id uuid REFERENCES public.portfolios(id),
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  changes jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_audit_logs_portfolio ON public.audit_logs(portfolio_id, created_at DESC);`}
          </pre>
        </div>
      )}
    </div>
  )
}
