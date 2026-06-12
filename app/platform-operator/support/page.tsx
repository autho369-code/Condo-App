import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { Alert, Badge } from '@/components/ui/shell';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { date } from '@/lib/utils';
import { Headphones, Clock, CheckCircle2, Timer } from 'lucide-react';

export const dynamic = 'force-dynamic';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
  );
}

const priorityTone = (p: string): Tone => {
  const m: Record<string, Tone> = { urgent: 'danger', high: 'danger', medium: 'warning', low: 'info' };
  return m[p?.toLowerCase()] ?? 'neutral';
};

async function setRequestStatus(formData: FormData) {
  'use server';
  await requirePlatformOperator();
  const supabase = await createClient();
  const id = formData.get('request_id') as string;
  const status = formData.get('status') as string;

  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'resolved' || status === 'closed') update.resolved_at = new Date().toISOString();

  const { error } = await (supabase as any).from('platform_requests').update(update).eq('id', id);
  if (error) redirect(`/platform-operator/support?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/platform-operator/support');
  redirect('/platform-operator/support?updated=1');
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  await requirePlatformOperator();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  let requests: any[] = [];
  try {
    const { data } = await db
      .from('platform_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    requests = data ?? [];
  } catch { requests = []; }

  const openCount = requests.filter((r: any) => !r.status || r.status === 'open' || r.status === 'pending').length;
  const inProgressCount = requests.filter((r: any) => r.status === 'in_progress' || r.status === 'processing').length;
  const resolvedToday = requests.filter((r: any) =>
    (r.status === 'resolved' || r.status === 'closed') && (r.resolved_at ?? r.updated_at) >= todayStart
  ).length;

  const portfolioMap = new Map<string, string>();
  try {
    const { data: ports } = await db.from('portfolios').select('id, company_name');
    for (const p of ports ?? []) portfolioMap.set(p.id, p.company_name);
  } catch {}

  return (
    <div className="space-y-6">
      {sp.error && <Alert title="Action failed">{sp.error}</Alert>}
      {sp.updated === '1' && <Alert tone="success" title="Request updated" />}

      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Support Requests</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Platform-wide support request management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open" value={openCount} icon={Headphones} />
        <StatCard label="In Progress" value={inProgressCount} icon={Clock} />
        <StatCard label="Resolved Today" value={resolvedToday} icon={CheckCircle2} />
        <StatCard label="Total" value={requests.length} icon={Timer} />
      </div>

      {/* Requests Table */}
      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">All Support Requests</h2>
          <p className="mt-0.5 text-xs text-gray-500">Requests submitted by company admins from their platform-requests workspace.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Company</th>
                <th className="px-4 py-2.5 text-left font-medium">Type</th>
                <th className="px-4 py-2.5 text-left font-medium">Subject</th>
                <th className="px-4 py-2.5 text-left font-medium">Priority</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Created</th>
                <th className="px-4 py-2.5 text-left font-medium">Updated</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Headphones className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <div className="text-sm font-semibold text-gray-900">No support requests found</div>
                    <div className="mt-1 text-xs text-gray-500">Company admins file requests from their workspace; they appear here.</div>
                  </td>
                </tr>
              ) : (
                requests.map((req: any) => {
                  const companyName = portfolioMap.get(req.portfolio_id) ?? '—';
                  const isOpen = !['resolved', 'closed', 'denied'].includes(req.status ?? 'open');
                  return (
                    <tr key={req.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-medium text-gray-900">{companyName}</td>
                      <td className="px-4 py-3 text-[13px] capitalize text-gray-700">{(req.request_type ?? 'general').replace(/_/g, ' ')}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-[13px] text-gray-700">{req.title ?? req.description ?? '—'}</td>
                      <td className="px-4 py-3"><StatusChip tone={priorityTone(req.priority)}>{req.priority ?? 'medium'}</StatusChip></td>
                      <td className="px-4 py-3"><Badge status={req.status ?? 'open'} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-gray-500">{date(req.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-gray-500">{date(req.updated_at ?? req.resolved_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {isOpen ? (
                          <div className="flex items-center justify-end gap-2">
                            {req.status !== 'in_progress' && (
                              <form action={setRequestStatus as any}>
                                <input type="hidden" name="request_id" value={req.id} />
                                <input type="hidden" name="status" value="in_progress" />
                                <button type="submit" className="text-xs font-medium text-gray-700 hover:text-gray-950 hover:underline">Start</button>
                              </form>
                            )}
                            <form action={setRequestStatus as any}>
                              <input type="hidden" name="request_id" value={req.id} />
                              <input type="hidden" name="status" value="resolved" />
                              <button type="submit" className="text-xs font-medium text-emerald-700 hover:underline">Resolve</button>
                            </form>
                            <form action={setRequestStatus as any}>
                              <input type="hidden" name="request_id" value={req.id} />
                              <input type="hidden" name="status" value="closed" />
                              <button type="submit" className="text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline">Close</button>
                            </form>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
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
