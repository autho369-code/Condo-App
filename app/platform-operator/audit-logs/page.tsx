import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { date } from '@/lib/utils';
import { FileSearch, Filter, X, Calendar, Building2, User } from 'lucide-react';

export const dynamic = 'force-dynamic';

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    blue: 'bg-blue-100 text-blue-700 ring-blue-200',
    red: 'bg-red-100 text-red-700 ring-red-200',
    amber: 'bg-amber-100 text-amber-700 ring-amber-200',
    violet: 'bg-violet-100 text-violet-700 ring-violet-200',
    gray: 'bg-gray-100 text-gray-600 ring-gray-200',
  };
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${colors[color] ?? colors.gray}`}>
      {label}
    </span>
  );
}

export default async function AuditLogsPage() {
  await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;

  // Discover audit_logs schema
  let auditRows: any[] = [];
  let columns: string[] = [];
  try {
    const { data } = await db
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    auditRows = data ?? [];
    if (auditRows.length > 0) {
      columns = Object.keys(auditRows[0]);
    }
  } catch {
    auditRows = [];
  }

  // If empty or no schema, use sample column names
  if (columns.length === 0) {
    columns = ['id', 'action', 'actor_id', 'target_type', 'target_id', 'portfolio_id', 'details', 'ip_address', 'created_at'];
  }

  // Fetch portfolio/user info for labels
  let portfolioMap = new Map<string, string>();
  let userMap = new Map<string, string>();
  try {
    const [{ data: ports }, { data: profs }] = await Promise.all([
      db.from('portfolios').select('id, company_name'),
      db.from('profiles').select('id, full_name, email').limit(500),
    ]);
    for (const p of ports ?? []) portfolioMap.set(p.id, p.company_name);
    for (const p of profs ?? []) userMap.set(p.id, p.full_name ?? p.email ?? p.id);
  } catch {}

  // Get unique values for filters
  const uniqueActions = [...new Set(auditRows.map((r: any) => r.action ?? 'unknown').filter(Boolean))].sort();
  const uniqueCompanies = [...new Set(auditRows.map((r: any) => r.portfolio_id).filter(Boolean))].map((id: string) => ({
    id,
    name: portfolioMap.get(id) ?? id,
  }));

  // Smart column display
  const displayColumns = columns.filter((c) =>
    !['id', 'details'].includes(c) || columns.length <= 6
  );
  // Always include key columns
  const keyCols = ['action', 'actor_id', 'target_type', 'target_id', 'portfolio_id', 'created_at', 'ip_address'];

  const visibleCols = keyCols.filter((c) => columns.includes(c));
  if (visibleCols.length === 0) visibleCols.push(...columns.slice(0, 6));

  function renderCell(row: any, col: string) {
    const val = row[col];
    if (val === null || val === undefined) return <span className="text-gray-300">—</span>;

    if (col === 'portfolio_id') {
      return portfolioMap.get(val) ?? String(val).slice(0, 8);
    }
    if (col === 'actor_id' || col === 'user_id') {
      return userMap.get(val) ?? String(val).slice(0, 8);
    }
    if (col === 'created_at' || col === 'timestamp') {
      return date(val);
    }
    if (col === 'action') {
      return <Badge label={String(val)} color="blue" />;
    }
    if (col === 'status') {
      return <Badge label={String(val)} color={val === 'success' ? 'emerald' : val === 'error' ? 'red' : 'gray'} />;
    }
    if (col === 'details' || col === 'metadata') {
      const str = typeof val === 'string' ? val : JSON.stringify(val);
      return <span className="max-w-[200px] block truncate text-gray-500 text-xs" title={str}>{str.slice(0, 80)}</span>;
    }

    return String(val).slice(0, 60);
  }

  function colLabel(col: string) {
    return col.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Platform-wide audit trail
          {auditRows.length > 0 && ` — ${auditRows.length} records, ${columns.length} columns`}
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input type="date" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700" />
            <span className="text-gray-400">to</span>
            <input type="date" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700" />
          </div>
          {/* Action Type */}
          <div className="flex items-center gap-2">
            <select className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
              <option value="">All Actions</option>
              {uniqueActions.map((a: string) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          {/* Company */}
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <select className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
              <option value="">All Companies</option>
              {uniqueCompanies.map((c: { id: string; name: string }) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {/* User */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            <select className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
              <option value="">All Users</option>
              {[...userMap.entries()].slice(0, 50).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A5F] px-4 py-1.5 text-sm text-white hover:bg-[#1E3A5F]/90">
            Apply Filters
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Audit Records</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {auditRows.length > 0
              ? `Columns: ${visibleCols.map(colLabel).join(', ')}`
              : 'No audit_logs data found — table may be empty'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                {visibleCols.map((col) => (
                  <th key={col} className="px-4 py-3 text-left whitespace-nowrap">{colLabel(col)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {auditRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length || 1} className="px-4 py-12 text-center">
                    <FileSearch className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <div className="text-sm text-gray-400">No audit logs found</div>
                    <div className="mt-1 text-xs text-gray-400">
                      The audit_logs table exists but contains no records, or the schema is undiscoverable.
                    </div>
                  </td>
                </tr>
              ) : (
                auditRows.map((row: any, i: number) => (
                  <tr key={row.id ?? i} className="hover:bg-gray-50">
                    {visibleCols.map((col) => (
                      <td key={col} className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {renderCell(row, col)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
