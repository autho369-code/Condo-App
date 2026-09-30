import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Badge } from '@/components/ui/shell';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { cancelServiceRequest } from '@/lib/rpcs/service-requests';
import { date } from '@/lib/utils';
import { currentWorkOrder } from '@/lib/maintenance/intake';
import { loadRequestAttachmentsByRequest } from '@/lib/maintenance/attachments';
import { MaintenanceAttachments } from '@/components/maintenance/attachments';

export const dynamic = 'force-dynamic';

const PRIORITY_TONE: Record<string, Tone> = {
  emergency: 'danger',
  high:      'warning',
  normal:    'neutral',
  low:       'info',
};

export default async function ServiceRequestsList({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const me = await requireAuth();
  const { submitted, error } = await searchParams;
  const supabase = await createClient();

  const { data: rows } = await (supabase as any)
    .from('service_requests')
    .select(`
      id, number, description, priority, status, source, created_on, created_at,
      permission_to_enter, resolution_note, homeowner_id, owner_id,
      units(unit_number, buildings(associations(name))),
      work_orders(id, status, created_at)
    `)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  const files = await loadRequestAttachmentsByRequest((rows ?? []).map((r: any) => r.id));
  const isMine = (r: any) => Boolean(me.owner_id) && (r.homeowner_id === me.owner_id || r.owner_id === me.owner_id);
  const justSubmitted = submitted ? (rows ?? []).find((r: any) => r.id === submitted && isMine(r)) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Service requests</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Report an issue or check on something you already submitted.</p>
        </div>
        <Link href="/portal/service-requests/new"><Button size="lg">+ New request</Button></Link>
      </div>

      {submitted && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your request was submitted. We&apos;ll follow up once it&apos;s been reviewed — usually within one business day.
        </div>
      )}

      {justSubmitted && (
        <Card>
          <CardHeader><CardTitle>Add photos to request #{justSubmitted.number ?? ''}</CardTitle></CardHeader>
          <CardBody>
            <p className="mb-3 text-sm text-gray-500">A photo of the problem helps us send the right vendor the first time.</p>
            <MaintenanceAttachments kind="service_request" parentId={justSubmitted.id} items={files.get(justSubmitted.id) ?? []}
              canUpload currentUserId={me.auth_user_id} canRemoveAny={false} emptyText="No photos yet." />
          </CardBody>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="font-semibold">Something went wrong:</span> {error}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Your requests</CardTitle></CardHeader>
        <CardBody>
          {rows && rows.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>#</TH>
                  <TH>Issue</TH>
                  <TH>Unit</TH>
                  <TH>Priority</TH>
                  <TH>Status</TH>
                  <TH>Submitted</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {rows.map((r: any) => {
                  const assoc = r.units?.buildings?.associations;
                  const wo    = currentWorkOrder(r);
                  const firstLine = (r.description ?? '').split('\n')[0];
                  const isOpen = r.status === 'open' || r.status === 'waiting';
                  return (
                    <TR key={r.id}>
                      <TD className="whitespace-nowrap font-mono text-xs text-gray-500">
                        {r.number ?? r.id.slice(0, 8)}
                      </TD>
                      <TD className="max-w-xs">
                        <div className="line-clamp-2 text-sm text-gray-900">{firstLine}</div>
                        {wo && (
                          <div className="mt-0.5 text-xs text-gray-500">
                            → Work order <span className="capitalize">{wo.status?.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                        {(files.get(r.id)?.length || (isOpen && isMine(r))) ? (
                          <details className="mt-1.5">
                            <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-950 hover:underline">
                              {files.get(r.id)?.length ? `${files.get(r.id)!.length} photo${files.get(r.id)!.length === 1 ? '' : 's'}` : 'Add photos'}
                            </summary>
                            <div className="mt-2 min-w-[16rem]">
                              <MaintenanceAttachments kind="service_request" parentId={r.id} items={files.get(r.id) ?? []}
                                canUpload={isOpen && isMine(r)} currentUserId={me.auth_user_id} canRemoveAny={false} />
                            </div>
                          </details>
                        ) : null}
                        {r.resolution_note && (
                          <div className="mt-1.5 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-700">
                            <span className="font-medium text-gray-900">Reply: </span>{r.resolution_note}
                          </div>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap text-sm">
                        {assoc?.name ? <span className="text-gray-500">{assoc.name} · </span> : null}
                        Unit {r.units?.unit_number ?? '—'}
                      </TD>
                      <TD>
                        <StatusChip tone={PRIORITY_TONE[r.priority] ?? 'neutral'}>{r.priority}</StatusChip>
                      </TD>
                      <TD>
                        <Badge status={r.status} />
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">{date(r.created_on ?? r.created_at)}</TD>
                      <TD>
                        {isOpen && !wo && (
                          <form action={cancelServiceRequest.bind(null, r.id) as any}>
                            <button type="submit" className="text-xs text-red-600 hover:underline">
                              Cancel
                            </button>
                          </form>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500">You haven&apos;t submitted any service requests yet.</p>
              <Link href="/portal/service-requests/new" className="mt-2 inline-block text-sm font-medium text-gray-700 hover:text-gray-950 hover:underline">
                Submit your first request →
              </Link>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
