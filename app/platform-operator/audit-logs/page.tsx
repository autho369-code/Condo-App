import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { Badge } from '@/components/ui/shell';
import { date } from '@/lib/utils';
import { FileSearch, Filter, Calendar, Building2, User } from 'lucide-react';

export const dynamic = 'force-dynamic';

const inputCls = 'rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; action?: string; company?: string; user?: string }>;
}) {
  await requirePlatformOperator();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  // Filtered audit query
  let auditRows: any[] = [];
  try {
    let query = db
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (sp.from) query = query.gte('created_at', sp.from);
    if (sp.to) query = query.lte('created_at', `${sp.to}T23:59:59`);
    if (sp.action) query = query.eq('action', sp.action);
    if (sp.company) query = query.eq('entity_id', sp.company);
    if (sp.user) query = query.eq('actor_id', sp.user);
    const { data } = await query;
    auditRows = data ?? [];
  } catch {
    auditRows = [];
  }

  // Unfiltered slice for filter dropdown options
  let allRows: any[] = auditRows;
  try {
    if (sp.from || sp.to || sp.action || sp.company || sp.user) {
      const { data } = await db.from('audit_logs').select('action, entity_id, actor_id').limit(500);
      allRows = data ?? [];
    }
  } catch {}

  // Fetch portfolio/user info for labels
  const portfolioMap = new Map<string, string>();
  const userMap = new Map<string, string>();
  try {
    const [{ data: ports }, { data: profs }] = await Promise.all([
      db.from('portfolios').select('id, company_name'),
      db.from('profiles').select('id, full_name, email').limit(500),
    ]);
    for (const p of ports ?? []) portfolioMap.set(p.id, p.company_name);
    for (const p of profs ?? []) userMap.set(p.id, p.full_name ?? p.email ?? p.id);
  } catch {}

  const uniqueActions = [...new Set(allRows.map((r: any) => r.action).filter(Boolean))].sort() as string[];
  const uniqueCompanies = [...new Set(allRows.map((r: any) => r.entity_id).filter(Boolean))]
    .filter((id: any) => portfolioMap.has(id))
    .map((id: any) => ({ id, name: portfolioMap.get(id)! }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Audit Logs</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Platform-wide audit trail
          {auditRows.length > 0 && ` — ${auditRows.length} records`}
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>
        <form className="flex flex-wrap items-center gap-3">
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input type="date" name="from" defaultValue={sp.from ?? ''} className={inputCls} />
            <span className="text-gray-400">to</span>
            <input type="date" name="to" defaultValue={sp.to ?? ''} className={inputCls} />
          </div>
          {/* Action Type */}
          <select name="action" defaultValue={sp.action ?? ''} className={inputCls}>
            <option value="">All Actions</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>
          {/* Company */}
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <select name="company" defaultValue={sp.company ?? ''} className={inputCls}>
              <option value="">All Companies</option>
              {uniqueCompanies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {/* User */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            <select name="user" defaultValue={sp.user ?? ''} className={inputCls}>
              <option value="">All Users</option>
              {[...userMap.entries()].slice(0, 50).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl bg-gray-950 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800">
            Apply Filters
          </button>
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Audit Records</h2>
          <p className="mt-0.5 text-xs text-gray-500">Date, time, user, action, and affected company for every platform event.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-2.5 text-left font-medium">Date &amp; Time</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left font-medium">User</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left font-medium">Action</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left font-medium">Affected Company</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left font-medium">Details</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <FileSearch className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <div className="text-sm font-semibold text-gray-900">No audit logs found</div>
                    <div className="mt-1 text-xs text-gray-500">
                      Platform actions (company created, plan changed, suspensions, password resets) appear here as they happen.
                    </div>
                  </td>
                </tr>
              ) : (
                auditRows.map((row: any, i: number) => {
                  const changes = row.changes ? (typeof row.changes === 'string' ? row.changes : JSON.stringify(row.changes)) : '';
                  return (
                    <tr key={row.id ?? i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="whitespace-nowrap px-4 py-3 text-[13px] tabular-nums text-gray-700">
                        {date(row.created_at)}{' '}
                        <span className="text-xs text-gray-400">
                          {row.created_at ? new Date(row.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[13px] text-gray-700">
                        {row.actor_email ?? userMap.get(row.actor_id) ?? (row.actor_id ? String(row.actor_id).slice(0, 8) : '—')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge status={row.action ?? '—'} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[13px] text-gray-700">
                        {portfolioMap.get(row.entity_id) ?? (row.entity_type ? `${row.entity_type} ${String(row.entity_id ?? '').slice(0, 8)}` : '—')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block max-w-[280px] truncate text-xs text-gray-500" title={changes}>{changes.slice(0, 120) || '—'}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-gray-500">{row.ip_address ?? '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
