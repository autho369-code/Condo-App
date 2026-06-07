import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { date } from '@/lib/utils';
import { Headphones, Clock, CheckCircle2, Timer, MessageSquare, UserPlus, XCircle, CheckCheck, Reply } from 'lucide-react';

export const dynamic = 'force-dynamic';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'navy',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
  accent?: 'navy' | 'emerald' | 'amber' | 'red' | 'violet';
}) {
  const accents: Record<string, string> = {
    navy: 'bg-[#1E3A5F]/10 text-[#1E3A5F] border-[#1E3A5F]/20',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    violet: 'bg-violet-100 text-violet-700 border-violet-200',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    blue: 'bg-blue-100 text-blue-700 ring-blue-200',
    red: 'bg-red-100 text-red-700 ring-red-200',
    amber: 'bg-amber-100 text-amber-700 ring-amber-200',
    violet: 'bg-violet-100 text-violet-700 ring-violet-200',
    gray: 'bg-gray-100 text-gray-600 ring-gray-200',
  };
  const lumPriority: Record<string, string> = {
    high: 'red',
    medium: 'amber',
    low: 'emerald',
    urgent: 'red',
  };
  const finalColor = lumPriority[label.toLowerCase()] ?? color;
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${colors[finalColor] ?? colors.gray}`}>
      {label}
    </span>
  );
}

export default async function SupportPage() {
  await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Query platform_requests table - discover columns dynamically
  let requests: any[] = [];
  try {
    const { data } = await db
      .from('platform_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    requests = data ?? [];
  } catch { requests = []; }

  // If platform_requests is empty, try common column names
  // Compute stats using flexible access
  const getField = (obj: any, ...names: string[]) => {
    for (const n of names) if (obj?.[n] !== undefined) return obj[n];
    return undefined;
  };

  const openCount = requests.filter((r: any) => {
    const s = getField(r, 'status');
    return !s || s === 'open' || s === 'pending';
  }).length;

  const inProgressCount = requests.filter((r: any) => {
    const s = getField(r, 'status');
    return s === 'in_progress' || s === 'processing';
  }).length;

  const resolvedToday = requests.filter((r: any) => {
    const s = getField(r, 'status');
    const resolvedAt = getField(r, 'resolved_at', 'closed_at', 'updated_at');
    return (s === 'resolved' || s === 'closed') && resolvedAt && resolvedAt >= todayStart;
  }).length;

  // Fetch portfolios for company names
  let portfolioMap = new Map<string, string>();
  try {
    const { data: ports } = await db.from('portfolios').select('id, company_name');
    for (const p of ports ?? []) portfolioMap.set(p.id, p.company_name);
  } catch {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support Requests</h1>
        <p className="mt-1 text-sm text-gray-500">Platform-wide support request management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open" value={openCount} icon={Headphones} accent="amber" />
        <StatCard label="In Progress" value={inProgressCount} icon={Clock} accent="navy" />
        <StatCard label="Resolved Today" value={resolvedToday} icon={CheckCircle2} accent="emerald" />
        <StatCard label="Total" value={requests.length} icon={Timer} accent="navy" />
      </div>

      {/* Action Bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Quick Actions</div>
        <div className="flex flex-wrap gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Reply className="h-4 w-4" /> Reply
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <UserPlus className="h-4 w-4" /> Assign Staff
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <CheckCheck className="h-4 w-4" /> Approve
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <XCircle className="h-4 w-4" /> Deny
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <CheckCircle2 className="h-4 w-4" /> Close
          </button>
        </div>
      </div>

      {/* Requests Table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">All Support Requests</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {requests.length > 0
              ? `Showing ${requests.length} requests — columns discovered: ${Object.keys(requests[0] ?? {}).slice(0, 8).join(', ')}`
              : 'No platform_requests table data found'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Headphones className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <div className="text-sm text-gray-400">No support requests found</div>
                    <div className="mt-1 text-xs text-gray-400">The platform_requests table may be empty or unavailable</div>
                  </td>
                </tr>
              ) : (
                requests.map((req: any) => {
                  const companyName = portfolioMap.get(req.portfolio_id) ?? req.portfolio_id ?? '—';
                  const type = getField(req, 'type', 'request_type', 'category') ?? 'General';
                  const subject = getField(req, 'subject', 'title', 'description') ?? '—';
                  const priority = getField(req, 'priority', 'severity') ?? 'medium';
                  const status = getField(req, 'status') ?? 'open';
                  const created = getField(req, 'created_at', 'requested_at') ?? null;
                  const updated = getField(req, 'updated_at', 'resolved_at') ?? null;
                  return (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{companyName}</td>
                      <td className="px-4 py-3 text-gray-600">{type}</td>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-700">{subject}</td>
                      <td className="px-4 py-3"><Badge label={priority} /></td>
                      <td className="px-4 py-3">
                        <Badge
                          label={status.replace(/_/g, ' ')}
                          color={status === 'open' ? 'amber' : status === 'in_progress' ? 'blue' : status === 'resolved' || status === 'closed' ? 'emerald' : 'gray'}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">{date(created)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">{date(updated)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="cursor-pointer text-xs text-[#1E3A5F] hover:underline">Reply</span>
                          <span className="text-gray-300">|</span>
                          <span className="cursor-pointer text-xs text-[#1E3A5F] hover:underline">Assign</span>
                          <span className="text-gray-300">|</span>
                          <span className="cursor-pointer text-xs text-[#1E3A5F] hover:underline">Close</span>
                        </div>
                      </td>
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
