import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { WorkspaceHeader } from '@/components/workspace/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import {
  Search,
  FileSearch,
  UserCheck,
  Activity,
  LogIn,
  Hash,
  Globe,
  Filter,
  Calendar,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type AuditLogRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_user_id: string | null;
  actor_email: string | null;
  changes: any;
  ip_address: string | null;
  created_at: string;
};

type LoginAttemptRow = {
  id: string;
  at: string;
  email: string | null;
  ip_address: string | null;
  success: boolean;
  failure_reason: string | null;
  mfa_used: boolean;
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDate(ts: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function jsonPreview(obj: any, maxLen = 60): string {
  if (!obj || (typeof obj === 'object' && Object.keys(obj).length === 0)) return '—';
  try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + '…';
  } catch {
    return '—';
  }
}

function isToday(ts: string): boolean {
  const d = new Date(ts);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const me = await requirePlatformOperator();
  const sp = await searchParams;
  const supabase = await createClient();

  const search = typeof sp.search === 'string' ? sp.search.trim() : '';
  const entityTypeFilter = typeof sp.entity_type === 'string' ? sp.entity_type : '';
  const actionFilter = typeof sp.action === 'string' ? sp.action : '';
  const dateFrom = typeof sp.date_from === 'string' ? sp.date_from : '';
  const dateTo = typeof sp.date_to === 'string' ? sp.date_to : '';

  /* --- Fetch audit logs (permission_audit_log) --------------------------- */

  let auditQuery = (supabase as any)
    .from('permission_audit_log')
    .select(
      'id, action, target_entity_type, target_entity_id, actor_user_id, details, ip_address, at',
    )
    .order('at', { ascending: false })
    .limit(500);

  if (entityTypeFilter) {
    auditQuery = auditQuery.eq('target_entity_type', entityTypeFilter);
  }
  if (actionFilter) {
    auditQuery = auditQuery.eq('action', actionFilter);
  }
  if (dateFrom) {
    auditQuery = auditQuery.gte('at', dateFrom);
  }
  if (dateTo) {
    // Add one day to include the end date fully
    const endDate = new Date(dateTo);
    endDate.setDate(endDate.getDate() + 1);
    auditQuery = auditQuery.lt('at', endDate.toISOString().split('T')[0]);
  }

  const { data: rawAuditLogs } = await auditQuery;

  /* --- Fetch profiles for actor emails ----------------------------------- */

  const auditLogs: AuditLogRow[] = (rawAuditLogs ?? []).map((row: any) => ({
    id: row.id,
    entity_type: row.target_entity_type ?? '',
    entity_id: row.target_entity_id ?? '',
    action: row.action ?? '',
    actor_user_id: row.actor_user_id ?? null,
    actor_email: null, // filled below
    changes: row.details ?? null,
    ip_address: row.ip_address ?? null,
    created_at: row.at ?? '',
  }));

  // Batch-resolve actor emails from profiles
  const actorUserIds = [
    ...new Set(auditLogs.map((l) => l.actor_user_id).filter(Boolean)),
  ] as string[];

  if (actorUserIds.length > 0) {
    const { data: actorProfiles } = await (supabase as any)
      .from('profiles')
      .select('id, email')
      .in('id', actorUserIds);

    const emailById = new Map<string, string>(
      (actorProfiles ?? []).map((p: any) => [p.id, p.email]),
    );

    auditLogs.forEach((log) => {
      if (log.actor_user_id) {
        log.actor_email = emailById.get(log.actor_user_id) ?? null;
      }
    });
  }

  /* --- Fetch login attempts ---------------------------------------------- */

  const { data: rawLoginAttempts } = await (supabase as any)
    .from('login_attempts')
    .select('id, at, email, ip_address, success, failure_reason, mfa_used')
    .order('at', { ascending: false })
    .limit(200);

  const loginAttempts: LoginAttemptRow[] = (rawLoginAttempts ?? []).map((row: any) => ({
    id: row.id,
    at: row.at ?? '',
    email: row.email ?? null,
    ip_address: row.ip_address ?? null,
    success: row.success ?? false,
    failure_reason: row.failure_reason ?? null,
    mfa_used: row.mfa_used ?? false,
  }));

  /* --- Client-side search filtering -------------------------------------- */

  let filteredLogs = auditLogs;
  if (search) {
    const q = search.toLowerCase();
    filteredLogs = filteredLogs.filter(
      (log) =>
        (log.action || '').toLowerCase().includes(q) ||
        (log.entity_type || '').toLowerCase().includes(q) ||
        (log.entity_id || '').toLowerCase().includes(q) ||
        (log.actor_email || '').toLowerCase().includes(q) ||
        (log.ip_address || '').toLowerCase().includes(q) ||
        (log.changes ? JSON.stringify(log.changes).toLowerCase().includes(q) : false),
    );
  }

  /* --- Stats ------------------------------------------------------------- */

  const totalLogEntries = auditLogs.length;
  const uniqueActors = new Set(auditLogs.map((l) => l.actor_email).filter(Boolean)).size;
  const actionsToday = auditLogs.filter((l) => isToday(l.created_at)).length;

  // Distinct entity types and actions for filter dropdowns
  const entityTypes = [...new Set(auditLogs.map((l) => l.entity_type).filter(Boolean))].sort();
  const actions = [...new Set(auditLogs.map((l) => l.action).filter(Boolean))].sort();

  const totalLoginAttempts = loginAttempts.length;
  const successfulLogins = loginAttempts.filter((la) => la.success).length;
  const failedLogins = loginAttempts.filter((la) => !la.success).length;

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="-mx-8 -my-8 min-h-[calc(100vh-64px)] bg-[#060B18]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="[&_h1]:text-white [&_.text-gray-500]:text-slate-400 [&_.text-gray-900]:text-white">
          <WorkspaceHeader
            eyebrow="Security & Compliance"
            title="Audit Logs & Login History"
            subtitle="Track every administrative action, entity change, and authentication attempt across the platform. Filter by entity type, action, or date range."
          />
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 space-y-6">
        {/* ── Stats Row ─────────────────────────────────────────────────── */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <StatDark label="Total Log Entries" value={totalLogEntries} accent="slate" />
          <StatDark label="Unique Actors" value={uniqueActors} accent="blue" />
          <StatDark label="Actions Today" value={actionsToday} accent="emerald" />
          <StatDark label="Login Attempts" value={totalLoginAttempts} accent="slate" />
          <StatDark label="Successful" value={successfulLogins} accent="emerald" />
          <StatDark label="Failed" value={failedLogins} accent={failedLogins > 0 ? 'rose' : 'slate'} />
        </div>

        {/* ── Audit Logs Section ────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-white">Audit Log Entries</h2>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-500">
                {filteredLogs.length} of {totalLogEntries}
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="border-b border-white/[0.04] px-5 py-3">
            <form className="flex flex-wrap items-end gap-3">
              {/* Search */}
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                <span className="mb-1 flex items-center gap-1.5">
                  <Search className="h-3 w-3" />
                  Search
                </span>
                <input
                  name="search"
                  defaultValue={search}
                  placeholder="Actor, action, entity, IP…"
                  className="mt-1 h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 w-52"
                />
              </label>

              {/* Entity Type */}
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                <span className="mb-1 flex items-center gap-1.5">
                  <Hash className="h-3 w-3" />
                  Entity Type
                </span>
                <select
                  name="entity_type"
                  defaultValue={entityTypeFilter}
                  className="mt-1 h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                >
                  <option value="">All types</option>
                  {entityTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              {/* Action */}
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                <span className="mb-1 flex items-center gap-1.5">
                  <Activity className="h-3 w-3" />
                  Action
                </span>
                <select
                  name="action"
                  defaultValue={actionFilter}
                  className="mt-1 h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                >
                  <option value="">All actions</option>
                  {actions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>

              {/* Date From */}
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                <span className="mb-1 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  From
                </span>
                <input
                  type="date"
                  name="date_from"
                  defaultValue={dateFrom}
                  className="mt-1 h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </label>

              {/* Date To */}
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                <span className="mb-1 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  To
                </span>
                <input
                  type="date"
                  name="date_to"
                  defaultValue={dateTo}
                  className="mt-1 h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </label>

              <button
                type="submit"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 transition"
              >
                <Filter className="h-3.5 w-3.5" />
                Apply
              </button>

              {(search || entityTypeFilter || actionFilter || dateFrom || dateTo) && (
                <a
                  href="/platform/audit-logs"
                  className="inline-flex h-8 items-center text-xs text-slate-500 hover:text-slate-300 transition"
                >
                  Clear all
                </a>
              )}
            </form>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table className="border-0">
              <THead
                className="text-xs uppercase tracking-wider text-slate-400"
                style={{ backgroundColor: '#0F1320' }}
              >
                <TR className="border-white/[0.04]">
                  <TH className="min-w-[160px]">Date / Time</TH>
                  <TH className="min-w-[160px]">Actor</TH>
                  <TH className="min-w-[120px]">Action</TH>
                  <TH className="min-w-[100px]">Entity Type</TH>
                  <TH className="min-w-[100px]">Entity ID</TH>
                  <TH className="min-w-[200px]">Details</TH>
                  <TH className="min-w-[130px]">IP Address</TH>
                </TR>
              </THead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <TR className="border-white/[0.04]">
                    <TD colSpan={7} className="py-14 text-center text-slate-500">
                      {search || entityTypeFilter || actionFilter || dateFrom || dateTo
                        ? 'No audit entries match your filters.'
                        : 'No audit log entries recorded yet.'}
                    </TD>
                  </TR>
                ) : (
                  filteredLogs.map((log) => (
                    <TR
                      key={log.id}
                      className="border-white/[0.04] transition hover:bg-white/[0.02]"
                    >
                      <TD>
                        <div className="text-sm text-slate-300 tabular-nums">
                          {formatDate(log.created_at)}
                        </div>
                      </TD>
                      <TD>
                        {log.actor_email ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
                            <UserCheck className="h-3.5 w-3.5 text-slate-500" />
                            {log.actor_email}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-600">System</span>
                        )}
                      </TD>
                      <TD>
                        <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium text-slate-300">
                          {log.action}
                        </span>
                      </TD>
                      <TD>
                        <span className="text-sm text-slate-400">{log.entity_type || '—'}</span>
                      </TD>
                      <TD>
                        <span className="font-mono text-xs text-slate-500">
                          {log.entity_id ? log.entity_id.slice(0, 8) + '…' : '—'}
                        </span>
                      </TD>
                      <TD>
                        <span className="font-mono text-xs text-slate-500 max-w-[180px] truncate block">
                          {jsonPreview(log.changes)}
                        </span>
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Globe className="h-3 w-3" />
                          {log.ip_address || '—'}
                        </span>
                      </TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.04] px-4 py-2 text-xs text-slate-600">
            Showing {filteredLogs.length} of {totalLogEntries} audit log entries
            {(search || entityTypeFilter || actionFilter || dateFrom || dateTo) && ' (filtered)'}
          </div>
        </div>

        {/* ── Login History Section ─────────────────────────────────────── */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-white">Login History</h2>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-500">
                {loginAttempts.length} attempts
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="border-0">
              <THead
                className="text-xs uppercase tracking-wider text-slate-400"
                style={{ backgroundColor: '#0F1320' }}
              >
                <TR className="border-white/[0.04]">
                  <TH className="min-w-[160px]">Date</TH>
                  <TH className="min-w-[200px]">Email</TH>
                  <TH className="min-w-[130px]">IP Address</TH>
                  <TH className="min-w-[100px]">Result</TH>
                  <TH className="min-w-[80px]">MFA</TH>
                </TR>
              </THead>
              <tbody>
                {loginAttempts.length === 0 ? (
                  <TR className="border-white/[0.04]">
                    <TD colSpan={5} className="py-14 text-center text-slate-500">
                      No login attempts recorded yet.
                    </TD>
                  </TR>
                ) : (
                  loginAttempts.map((la) => (
                    <TR
                      key={la.id}
                      className="border-white/[0.04] transition hover:bg-white/[0.02]"
                    >
                      <TD>
                        <div className="text-sm text-slate-300 tabular-nums">
                          {formatDate(la.at)}
                        </div>
                      </TD>
                      <TD>
                        <span className="text-sm text-slate-300">
                          {la.email || '—'}
                        </span>
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Globe className="h-3 w-3" />
                          {la.ip_address || '—'}
                        </span>
                      </TD>
                      <TD>
                        {la.success ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-400/30">
                            Success
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-rose-400/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400 ring-1 ring-inset ring-rose-400/30"
                            title={la.failure_reason ?? undefined}
                          >
                            Failed
                          </span>
                        )}
                      </TD>
                      <TD>
                        {la.mfa_used ? (
                          <span className="inline-flex items-center rounded-full bg-blue-400/10 px-2 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/30">
                            MFA
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dark-themed Stat                                                          */
/* -------------------------------------------------------------------------- */

function StatDark({
  label,
  value,
  accent = 'slate',
}: {
  label: string;
  value: React.ReactNode;
  accent?: 'slate' | 'emerald' | 'blue' | 'amber' | 'rose';
}) {
  const borderMap: Record<string, string> = {
    slate: 'border-slate-700/40',
    emerald: 'border-emerald-500/30',
    blue: 'border-blue-500/30',
    amber: 'border-amber-500/30',
    rose: 'border-rose-500/30',
  };
  const bgMap: Record<string, string> = {
    slate: 'bg-white/[0.02]',
    emerald: 'bg-emerald-500/5',
    blue: 'bg-blue-500/5',
    amber: 'bg-amber-500/5',
    rose: 'bg-rose-500/5',
  };
  const valueMap: Record<string, string> = {
    slate: 'text-slate-100',
    emerald: 'text-emerald-300',
    blue: 'text-blue-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
  };

  return (
    <div
      className={`rounded-lg border ${borderMap[accent]} ${bgMap[accent]} p-4`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valueMap[accent]}`}>
        {value}
      </div>
    </div>
  );
}
