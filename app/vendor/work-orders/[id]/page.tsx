import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth/me';
import { loadMaintenanceAttachments } from '@/lib/maintenance/attachments';
import { MaintenanceAttachments } from '@/components/maintenance/attachments';
import { notifyOwnerOfStatusChange } from '@/lib/notifications/status-change';
import { PageHeader, Surface, SectionTitle, Badge, Alert } from '@/components/ui/shell';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { Field, Select, Textarea } from '@/components/ui/input';
import { ArcMessageThread, type ArcMessage } from '@/components/architectural/message-thread';
import { postWorkOrderMessage } from '@/lib/rpcs/work-orders-messages';
import { claimSubmission, completeSubmission, newSubmissionToken, releaseSubmission, SUBMISSION_FIELD } from '@/lib/forms/submission';
import { canVendorChangeStatus, isVendorSettableStatus } from '@/lib/vendors/portal';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_ACCEPTED = 'That status change was not accepted — this job may already be completed or billed. Contact the manager.';

const VENDOR_STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Work complete' },
] as const;

export default async function VendorWorkOrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireVendor();
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const db = supabase as any;

  const { data: wo, error: woError } = await db
    .from('work_orders')
    .select('id, number, title, status, priority, description, job_description, service_request_id, scheduled_date, scheduled_time, completed_date, created_at, associations(name, address, city, state), units(unit_number)')
    .eq('id', id)
    .in('vendor_id', me.vendor_ids)
    .is('archived_at', null)
    .maybeSingle();
  if (woError) throw new Error(`Could not load the work order: ${woError.message}`);
  if (!wo) notFound();

  const [instructionsResult, updatesResult, messagesResult] = await Promise.all([
    // Instructions for the vendor are not on the work order row (owners and
    // board read it); RLS lets the assigned vendor read them here.
    db.from('work_order_vendor_private')
      .select('vendor_instructions')
      .eq('work_order_id', id)
      .maybeSingle(),
    db.from('work_order_updates')
      .select('id, note, new_status, created_at')
      .eq('work_order_id', id)
      .order('created_at', { ascending: false })
      .limit(30),
    db.from('work_order_messages')
      .select('id, author_name, author_role, body, created_at')
      .eq('work_order_id', id)
      .order('created_at', { ascending: true }),
  ]);
  const loadErrors = [
    instructionsResult.error && `instructions (${instructionsResult.error.message})`,
    updatesResult.error && `activity (${updatesResult.error.message})`,
    messagesResult.error && `messages (${messagesResult.error.message})`,
  ].filter(Boolean) as string[];
  const vendorInstructions: string | null = instructionsResult.data?.vendor_instructions ?? null;
  const updates = updatesResult.data ?? [];
  const messages = messagesResult.data ?? [];

  const attachments = await loadMaintenanceAttachments({ workOrderId: wo.id, serviceRequestId: wo.service_request_id });

  async function postUpdate(formData: FormData) {
    'use server';
    const me2 = await requireVendor();
    const supabase2 = await createClient();
    const db2 = supabase2 as any;
    const woId = String(formData.get('work_order_id') ?? '');
    if (!UUID.test(woId)) redirect(`/vendor/work-orders?error=${encodeURIComponent('That work order is not available.')}`);
    const back = `/vendor/work-orders/${woId}`;
    const fail = (message: string): never => redirect(`${back}?error=${encodeURIComponent(message)}`);
    const rawStatus = String(formData.get('new_status') ?? '');
    const note = String(formData.get('note') ?? '').trim();

    if (rawStatus && !isVendorSettableStatus(rawStatus)) fail('Pick a status from the list.');
    if (note.length > 4000) fail('Keep the note under 4,000 characters.');

    // The work order must be assigned to one of this login's vendor records and still active.
    const { data: current, error: loadErr } = await db2
      .from('work_orders').select('id, status')
      .eq('id', woId).in('vendor_id', me2.vendor_ids).is('archived_at', null)
      .maybeSingle();
    if (loadErr) fail(loadErr.message);
    if (!current) redirect(`/vendor/work-orders?error=${encodeURIComponent('That work order is not available.')}`);

    // Picking the status the job already has is just a note.
    const newStatus: string | null = rawStatus && rawStatus !== current.status ? rawStatus : null;
    if (!note && !newStatus) fail('Add a note or pick a new status before posting.');
    if (newStatus && !canVendorChangeStatus(current.status, newStatus)) fail(NOT_ACCEPTED);

    const claim = await claimSubmission(db2, formData, 'vendor_work_order_update');
    if (claim.status === 'error') fail(claim.message);
    if (claim.status === 'duplicate') redirect(`${back}?saved=1`);
    const token = (claim as { token: string }).token;

    if (newStatus) {
      // completed_date is stamped by the database in the association's time zone.
      const { data: updated, error: upErr } = await db2.from('work_orders')
        .update({ status: newStatus })
        .eq('id', woId).in('vendor_id', me2.vendor_ids)
        .select('id, status');
      if (upErr || !updated || updated.length === 0 || updated[0].status !== newStatus) {
        await releaseSubmission(db2, token);
        fail(upErr?.message ?? NOT_ACCEPTED);
      }
      // Keep the homeowner informed. Helper never throws, so it can't fail the action.
      await notifyOwnerOfStatusChange({ kind: 'work_order', id: woId, newStatus });
    }

    // Log the note only after the status change actually applied.
    const { data: logged, error: insErr } = await db2.from('work_order_updates').insert({
      work_order_id: woId,
      note: note || `Status changed to ${String(newStatus).replace(/_/g, ' ')}`,
      new_status: newStatus,
      created_by: me2.auth_user_id,
    }).select('id').single();
    if (insErr || !logged) {
      // A note-only post can be retried; once the status changed, keep the
      // token claimed so a resend can't apply the change twice.
      if (!newStatus) await releaseSubmission(db2, token);
      fail(insErr?.message ?? 'The update could not be logged.');
    }
    await completeSubmission(db2, token, logged.id);

    revalidatePath(back);
    redirect(`${back}?saved=1`);
  }

  const assocLine = [wo.associations?.name, wo.units?.unit_number && `Unit ${wo.units.unit_number}`].filter(Boolean).join(' · ');
  const addressLine = [wo.associations?.address, [wo.associations?.city, wo.associations?.state].filter(Boolean).join(', ')].filter(Boolean).join(', ');

  return (
    <div>
      <Link href="/vendor/work-orders" className="mb-3 inline-flex min-h-10 items-center gap-1 text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900">
        <ArrowLeft className="h-3.5 w-3.5" /> Work orders
      </Link>
      <PageHeader
        title={`${wo.number ? `#${wo.number} · ` : ''}${wo.title ?? 'Work order'}`}
        description={assocLine}
        actions={<Badge status={wo.status} className="px-3 py-1 text-[12px]" />}
      />

      {sp.error && <Alert tone="danger" title="Could not save:" className="mb-5">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success" className="mb-5">Update posted. The management team can see it immediately.</Alert>}
      {loadErrors.length > 0 && (
        <Alert tone="danger" title="Some details could not be loaded:" className="mb-5">{loadErrors.join('; ')}</Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Surface>
            <SectionTitle title="Job details" />
            <dl className="space-y-3 text-[13px] leading-5">
              {(wo.job_description || wo.description) && (
                <div>
                  <dt className="font-medium text-gray-500">Description</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-gray-800">{wo.job_description ?? wo.description}</dd>
                </div>
              )}
              {vendorInstructions && (
                <div>
                  <dt className="font-medium text-gray-500">Instructions for you</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-gray-800">{vendorInstructions}</dd>
                </div>
              )}
              {addressLine && (
                <div>
                  <dt className="font-medium text-gray-500">Location</dt>
                  <dd className="mt-0.5 text-gray-800">{addressLine}</dd>
                </div>
              )}
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                {wo.scheduled_date && (
                  <div>
                    <dt className="font-medium text-gray-500">Scheduled</dt>
                    <dd className="mt-0.5 text-gray-800">{date(wo.scheduled_date)}{wo.scheduled_time ? ` · ${wo.scheduled_time}` : ''}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-gray-500">Created</dt>
                  <dd className="mt-0.5 text-gray-800">{date(wo.created_at)}</dd>
                </div>
                {wo.completed_date && (
                  <div>
                    <dt className="font-medium text-gray-500">Completed</dt>
                    <dd className="mt-0.5 text-gray-800">{date(wo.completed_date)}</dd>
                  </div>
                )}
              </div>
            </dl>
          </Surface>

          <Surface>
            <SectionTitle title="Photos & files" description="The resident's photos of the problem, plus anything you add — before/after photos, quotes, invoices." />
            <MaintenanceAttachments
              kind="work_order"
              parentId={wo.id}
              items={attachments}
              canUpload={!['completed', 'closed', 'cancelled', 'billed'].includes(wo.status)}
              currentUserId={me.auth_user_id}
              canRemoveAny={false}
            />
          </Surface>

          <Surface>
            <SectionTitle title="Activity" description="Updates are visible to the management team." />
            {updates.length === 0 ? (
              <p className="text-[13px] text-gray-400">No updates yet.</p>
            ) : (
              <ul className="space-y-4">
                {updates.map((u: any) => (
                  <li key={u.id} className="flex gap-3">
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-gray-300" />
                    <div className="min-w-0">
                      <div className="text-[13px] leading-5 text-gray-800">{u.note}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400">
                        {date(u.created_at)}
                        {u.new_status && <Badge status={u.new_status} />}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Surface>

          <Surface>
            <SectionTitle title="Discussion" description="Messages here are visible to the management team and the homeowner." />
            <ArcMessageThread
              messages={messages as ArcMessage[]}
              postAction={postWorkOrderMessage.bind(null, id, '/vendor/work-orders') as any}
              placeholder="Ask the management team a question…"
            />
          </Surface>
        </div>

        <Surface className="h-fit">
          <SectionTitle title="Post an update" />
          <form action={postUpdate} className="space-y-4">
            <input type="hidden" name="work_order_id" value={wo.id} />
            <input type="hidden" name={SUBMISSION_FIELD} value={newSubmissionToken()} />
            <Field label="Status">
              <Select name="new_status" defaultValue="">
                <option value="">Keep current status</option>
                {VENDOR_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Note" hint="What was done, what's needed next, access issues, etc.">
              <Textarea name="note" maxLength={4000} placeholder="e.g. Replaced shut-off valve, testing for leaks tomorrow morning." />
            </Field>
            <PendingSubmit pendingLabel="Posting…">Post update</PendingSubmit>
          </form>
        </Surface>
      </div>
    </div>
  );
}
