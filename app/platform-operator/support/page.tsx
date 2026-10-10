import { Fragment } from 'react';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { Alert, Badge } from '@/components/ui/shell';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { date } from '@/lib/utils';
import { Label, Textarea } from '@/components/ui/input';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { displayTimeZone } from '@/lib/time/display-zone';
import { todayInZone, zonedWallTimeToUtc } from '@/lib/time/zoned';

const REQUEST_STATUSES = ['in_progress', 'resolved', 'closed'] as const;
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
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[13px] font-medium leading-5 text-gray-500">{label}</div>
          <div className="mt-1.5 font-display text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{value}</div>
          {sub && <div className="mt-1 text-[13px] text-gray-500">{sub}</div>}
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
  const id = String(formData.get('request_id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !(REQUEST_STATUSES as readonly string[]).includes(status)) {
    redirect(`/platform-operator/support?error=${encodeURIComponent('Invalid support request update.')}`);
  }

  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'resolved' || status === 'closed') update.resolved_at = new Date().toISOString();

  // Only open requests change; RLS hides the row from non-operators, so an
  // empty result must be reported rather than shown as success.
  const { data: updated, error } = await (supabase as any)
    .from('platform_requests')
    .update(update)
    .eq('id', id)
    // A missing status counts as open (as on the page); NOT IN alone would skip it.
    .or('status.is.null,status.not.in.(resolved,closed,denied)')
    .select('id');
  if (error) redirect(`/platform-operator/support?error=${encodeURIComponent(error.message)}`);
  if (!updated?.length) redirect(`/platform-operator/support?error=${encodeURIComponent('That request was not found or is already closed.')}`);
  revalidatePath('/platform-operator/support');
  redirect('/platform-operator/support?updated=1');
}

const MAX_RESPONSE_LENGTH = 5000;

async function respondToRequest(formData: FormData) {
  'use server';
  // Actions are callable endpoints: re-check the operator role here.
  await requirePlatformOperator();
  const supabase = await createClient();
  const id = String(formData.get('request_id') ?? '').trim();
  const response = String(formData.get('platform_response') ?? '').trim();
  const fail = (message: string): never =>
    redirect(`/platform-operator/support?error=${encodeURIComponent(message)}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) fail('Invalid support request.');
  if (!response) fail('Write a response before sending it.');
  if (response.length > MAX_RESPONSE_LENGTH) fail(`Responses are limited to ${MAX_RESPONSE_LENGTH.toLocaleString()} characters.`);

  // The company admin sees platform_response on their platform-requests page.
  const { data: updated, error } = await (supabase as any)
    .from('platform_requests')
    .update({ platform_response: response, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) fail(error.message);
  if (!updated?.length) fail('That request was not found or you are not allowed to answer it.');
  revalidatePath('/platform-operator/support');
  redirect('/platform-operator/support?responded=1');
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string; responded?: string }>;
}) {
  await requirePlatformOperator();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  // "Resolved today" means today in the platform zone (the server runs in UTC).
  const zone = displayTimeZone();
  const todayStart = zonedWallTimeToUtc(todayInZone(zone), '00:00', zone)?.getTime() ?? Date.now();

  const { data: requestRows, error: requestsError } = await db
    .from('platform_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  const requests: any[] = requestRows ?? [];

  const openCount = requests.filter((r: any) => !r.status || r.status === 'open' || r.status === 'pending').length;
  const inProgressCount = requests.filter((r: any) => r.status === 'in_progress' || r.status === 'processing').length;
  const resolvedToday = requests.filter((r: any) =>
    (r.status === 'resolved' || r.status === 'closed') && !!(r.resolved_at ?? r.updated_at) && Date.parse(r.resolved_at ?? r.updated_at) >= todayStart
  ).length;

  const portfolioMap = new Map<string, string>();
  const { data: ports, error: portfoliosError } = await db.from('portfolios').select('id, company_name');
  for (const p of ports ?? []) portfolioMap.set(p.id, p.company_name);
  const loadError = requestsError?.message ?? portfoliosError?.message ?? null;

  return (
    <div className="space-y-6">
      {sp.error && <Alert title="Action failed">{sp.error}</Alert>}
      {sp.updated === '1' && <Alert tone="success" title="Request updated" />}
      {sp.responded === '1' && <Alert tone="success" title="Response saved">The company admin can read it on their platform requests page.</Alert>}
      {loadError && <Alert title="Support requests could not be loaded">{loadError}</Alert>}

      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Support Requests</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">Platform-wide support request management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open" value={openCount} icon={Headphones} />
        <StatCard label="In Progress" value={inProgressCount} icon={Clock} />
        <StatCard label="Resolved Today" value={resolvedToday} icon={CheckCircle2} />
        <StatCard label="Total" value={requests.length} icon={Timer} />
      </div>

      {/* Requests Table */}
      <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">All Support Requests</h2>
          <p className="mt-0.5 text-[13px] text-gray-500">Requests submitted by company admins from their platform-requests workspace.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Company</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Type</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Subject</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Priority</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Status</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Created</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Updated</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Headphones className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <div className="text-sm font-semibold text-gray-900">No support requests found</div>
                    <div className="mt-1 text-[13px] text-gray-500">Company admins file requests from their workspace; they appear here.</div>
                  </td>
                </tr>
              ) : (
                requests.map((req: any) => {
                  const companyName = portfolioMap.get(req.portfolio_id) ?? '—';
                  const isOpen = !['resolved', 'closed', 'denied'].includes(req.status ?? 'open');
                  return (
                    <Fragment key={req.id}>
                    <tr className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-medium text-gray-900">{companyName}</td>
                      <td className="px-4 py-3 text-[13px] capitalize text-gray-700">{(req.request_type ?? 'general').replace(/_/g, ' ')}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-[13px] text-gray-700">{req.title ?? req.description ?? '—'}</td>
                      <td className="px-4 py-3.5"><StatusChip tone={priorityTone(req.priority)}>{req.priority ?? 'medium'}</StatusChip></td>
                      <td className="px-4 py-3.5"><Badge status={req.status ?? 'open'} /></td>
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
                          <span className="text-[13px] text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100 last:border-0">
                      <td colSpan={8} className="px-4 pb-4 pt-0">
                        <div className="grid gap-3 lg:grid-cols-2">
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-medium uppercase tracking-wide text-gray-400">Request</div>
                            <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 text-gray-700">{req.description || 'No description provided.'}</p>
                          </div>
                          <form action={respondToRequest as any} className="min-w-0 space-y-2">
                            <input type="hidden" name="request_id" value={req.id} />
                            <Label htmlFor={`response-${req.id}`} className="text-[12.5px] font-medium uppercase tracking-wide text-gray-400">
                              {req.platform_response ? 'Response (visible to the company admin)' : 'Reply to the company admin'}
                            </Label>
                            <Textarea
                              id={`response-${req.id}`}
                              name="platform_response"
                              rows={3}
                              required
                              maxLength={MAX_RESPONSE_LENGTH}
                              defaultValue={req.platform_response ?? ''}
                              placeholder="Write a response…"
                            />
                            <div className="flex justify-end">
                              <PendingSubmit size="sm" variant="secondary" pendingLabel="Saving…">
                                {req.platform_response ? 'Update response' : 'Send response'}
                              </PendingSubmit>
                            </div>
                          </form>
                        </div>
                      </td>
                    </tr>
                    </Fragment>
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
