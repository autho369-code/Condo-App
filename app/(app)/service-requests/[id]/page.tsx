import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight, Wrench } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Label, Select, Textarea } from '@/components/ui/input';
import { date } from '@/lib/utils';
import { loadMaintenanceAttachments } from '@/lib/maintenance/attachments';
import { MaintenanceAttachments } from '@/components/maintenance/attachments';
import {
  ADMIN_TOPIC_LABELS, CATEGORY_LABELS, REPLY_STARTERS, requestKindLabel, responseState,
} from '@/lib/maintenance/intake';
import {
  acknowledgeServiceRequest, clearDuplicateFlag, mergeServiceRequest, reclassifyServiceRequest,
  resolveServiceRequest, triageServiceRequest,
} from '../actions';
import { displayTimeZone } from '@/lib/time/display-zone';

export const dynamic = 'force-dynamic';

const SAVED: Record<string, string> = {
  acknowledged: 'Marked as responded.',
  resolved: 'Reply sent and request closed.',
  merged: 'Duplicate merged into this request. The resident was told where it is being tracked.',
  not_duplicate: 'Duplicate flag cleared.',
  reclassified: 'Request type updated.',
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function priorityTone(priority: string): Tone {
  if (priority === 'emergency') return 'danger';
  if (priority === 'high') return 'warning';
  return 'neutral';
}

function requester(row: any) {
  const tenant = one<any>(row.tenants);
  const owner = one<any>(row.homeowners) ?? one<any>(row.owners);
  if (tenant) return { name: `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() || 'Tenant', role: 'Tenant', email: tenant.email, phone: null };
  if (owner) return { name: owner.full_name ?? 'Owner', role: 'Owner', email: owner.email, phone: owner.phone ?? null };
  return { name: 'Staff', role: 'Internal', email: null, phone: null };
}

const SELECT = `
  id, number, description, priority, submitted_priority, status, source, permission_to_enter, created_at,
  request_kind, admin_topic, category, triage_reasons, duplicate_of, duplicate_score, duplicate_reviewed,
  first_response_due_at, acknowledged_at, resolution_note, resolved_at, association_id, unit_id,
  associations(name), units(unit_number),
  tenants:tenant_id(first_name, last_name, email),
  owners:owner_id(full_name, email, phone),
  homeowners:homeowner_id(full_name, email, phone),
  work_orders(id, number, status)
`;

export default async function ServiceRequestDetail({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const db = (await createClient()) as any;

  const { data: sr } = await db.from('service_requests').select(SELECT).eq('id', id).is('archived_at', null).maybeSingle();
  if (!sr) notFound();

  const [{ data: original }, { data: merged }, attachments] = await Promise.all([
    sr.duplicate_of
      ? db.from('service_requests').select(SELECT).eq('id', sr.duplicate_of).is('archived_at', null).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from('service_requests').select('id, number, description, status, created_at, owners:owner_id(full_name), homeowners:homeowner_id(full_name), tenants:tenant_id(first_name, last_name, email)')
      .eq('duplicate_of', id).order('created_at'),
    loadMaintenanceAttachments({ serviceRequestId: id }),
  ]);

  const who = requester(sr);
  const isOpen = sr.status === 'open' || sr.status === 'waiting';
  const workOrders = ((Array.isArray(sr.work_orders) ? sr.work_orders : sr.work_orders ? [sr.work_orders] : []) as any[]);
  const openWorkOrder = workOrders.find((w) => !['done', 'completed', 'billed', 'closed', 'cancelled'].includes(w.status));
  const response = responseState(sr);
  const showDuplicate = isOpen && original && !sr.duplicate_reviewed && ['open', 'waiting'].includes(original.status);
  const firstLine = String(sr.description ?? '').split('\n')[0];
  const reasons: string[] = sr.triage_reasons ?? [];

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/service-requests" className="transition-colors hover:text-gray-700">Service requests</Link>
              {' · '}<span>{sr.associations?.name ?? '—'}</span>
              {sr.units?.unit_number ? <>{' · '}<span>Unit {sr.units.unit_number}</span></> : null}
            </>
          }
          title={`#${sr.number ?? sr.id.slice(0, 8)} — ${firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine}`}
          subtitle={
            <span className="flex flex-wrap items-center gap-1.5">
              <StatusChip tone={priorityTone(sr.priority)}>{sr.priority}</StatusChip>
              <StatusChip tone={sr.request_kind === 'admin' ? 'info' : 'neutral'}>{requestKindLabel(sr.request_kind, sr.admin_topic, sr.category)}</StatusChip>
              <StatusChip tone={sr.status === 'completed' ? 'success' : sr.status === 'cancelled' ? 'neutral' : 'warning'}>{openWorkOrder ? 'In work order' : sr.status}</StatusChip>
              {response ? <StatusChip tone={response.tone}>{response.label}</StatusChip> : null}
            </span>
          }
        />
      }
      rail={
        <div className="space-y-5 text-sm">
          <div>
            <div className="mb-2 text-[13px] font-semibold text-gray-700">Next step</div>
            <div className="space-y-2">
              {openWorkOrder ? (
                <Link href={`/work-orders/${openWorkOrder.id}`}>
                  <Button className="w-full" variant="secondary">Open work order #{openWorkOrder.number ?? ''} <ArrowUpRight className="h-3.5 w-3.5" /></Button>
                </Link>
              ) : isOpen && sr.request_kind === 'maintenance' ? (
                <form action={triageServiceRequest.bind(null, sr.id)}>
                  <Button type="submit" className="w-full"><Wrench className="h-3.5 w-3.5" /> Create work order</Button>
                </form>
              ) : null}
              {isOpen && !sr.acknowledged_at ? (
                <form action={acknowledgeServiceRequest.bind(null, sr.id)}>
                  <Button type="submit" variant="secondary" className="w-full">Mark as responded</Button>
                </form>
              ) : null}
              {!isOpen && !openWorkOrder ? <p className="text-gray-500">This request is {sr.status}.</p> : null}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[13px] font-semibold text-gray-700">Response time</div>
            <dl className="space-y-1.5">
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Submitted</dt><dd>{date(sr.created_at)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Reply due</dt><dd>{sr.first_response_due_at ? new Date(sr.first_response_due_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: displayTimeZone() }) : '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Responded</dt><dd>{sr.acknowledged_at ? date(sr.acknowledged_at) : 'Not yet'}</dd></div>
            </dl>
          </div>

          {workOrders.length > 0 ? (
            <div>
              <div className="mb-2 text-[13px] font-semibold text-gray-700">Work orders</div>
              <ul className="space-y-1">
                {workOrders.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-2">
                    <Link href={`/work-orders/${w.id}`} className="font-medium text-gray-900 hover:underline">#{w.number ?? w.id.slice(0, 8)}</Link>
                    <StatusChip>{String(w.status).replace(/_/g, ' ')}</StatusChip>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      }
    >
      {sp.error ? <Alert className="mb-6">{sp.error}</Alert> : null}
      {sp.saved && SAVED[sp.saved] ? <Alert tone="success" className="mb-6">{SAVED[sp.saved]}</Alert> : null}

      {showDuplicate ? (
        <Section
          title={`Possible duplicate of #${original.number ?? original.id.slice(0, 8)}`}
          subtitle={`${Math.round(Number(sr.duplicate_score ?? 0) * 100)}% similar, same association, still open`}
        >
          <div className="px-5 py-4 text-sm">
            <p className="whitespace-pre-wrap text-gray-700">{original.description}</p>
            <p className="mt-2 text-xs text-gray-500">
              {requester(original).name} · {original.units?.unit_number ? `Unit ${original.units.unit_number}` : 'Common area'} · {date(original.created_at)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <form action={mergeServiceRequest.bind(null, sr.id)}>
                <input type="hidden" name="into_id" value={original.id} />
                <Button type="submit" size="sm">Merge into #{original.number ?? original.id.slice(0, 8)}</Button>
              </form>
              <form action={clearDuplicateFlag.bind(null, sr.id)}>
                <Button type="submit" size="sm" variant="secondary">Not a duplicate</Button>
              </form>
              <Link href={`/service-requests/${original.id}`}><Button size="sm" variant="ghost">Open #{original.number ?? ''}</Button></Link>
            </div>
            <p className="mt-3 text-xs text-gray-500">Merging closes this request and tells the resident the issue is tracked under #{original.number ?? ''}.</p>
          </div>
        </Section>
      ) : null}

      <Section title="Request">
        <div className="px-5 py-4 text-sm">
          <p className="whitespace-pre-wrap leading-6 text-gray-900">{sr.description}</p>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div><dt className="text-[13px] text-gray-500">Submitted by</dt><dd className="mt-0.5">{who.name} <span className="text-gray-400">({who.role})</span></dd></div>
            <div><dt className="text-[13px] text-gray-500">Contact</dt><dd className="mt-0.5 space-x-2">
              {who.email ? <a className="hover:underline" href={`mailto:${who.email}`}>{who.email}</a> : null}
              {who.phone ? <a className="hover:underline" href={`tel:${who.phone}`}>{who.phone}</a> : null}
              {!who.email && !who.phone ? '—' : null}
            </dd></div>
            <div><dt className="text-[13px] text-gray-500">Permission to enter</dt><dd className="mt-0.5">{sr.permission_to_enter ? 'Yes' : 'No'}</dd></div>
            <div><dt className="text-[13px] text-gray-500">Priority</dt><dd className="mt-0.5 capitalize">
              {sr.priority}{sr.submitted_priority && sr.submitted_priority !== sr.priority ? <span className="text-gray-500"> (resident chose {sr.submitted_priority})</span> : null}
            </dd></div>
          </dl>
        </div>
      </Section>

      <Section title="Photos & files">
        <div className="px-5 py-4">
          <MaintenanceAttachments kind="service_request" parentId={sr.id} items={attachments} canUpload={isOpen}
            currentUserId={me.auth_user_id} canRemoveAny emptyText="The resident didn't attach any photos." />
        </div>
      </Section>

      {sr.resolution_note ? (
        <Section title={sr.status === 'cancelled' ? 'Closed' : 'Reply sent to the resident'} subtitle={sr.resolved_at ? date(sr.resolved_at) : undefined}>
          <p className="whitespace-pre-wrap px-5 py-4 text-sm text-gray-800">{sr.resolution_note}</p>
        </Section>
      ) : null}

      {isOpen && !openWorkOrder ? (
        <Section
          title={sr.request_kind === 'admin' ? 'Answer and close' : 'Close without a work order'}
          subtitle={sr.request_kind === 'admin'
            ? 'This reads like a question, not a repair. Answer it here — the resident gets your reply by email and sees it in their portal.'
            : 'Use when the issue was handled another way. The resident gets your reply by email.'}
        >
          <form action={resolveServiceRequest.bind(null, sr.id)} className="space-y-3 px-5 py-4">
            <Label htmlFor="resolution_note">Reply to {who.name}</Label>
            <Textarea id="resolution_note" name="resolution_note" rows={5} required maxLength={5000}
              defaultValue={sr.request_kind === 'admin' ? REPLY_STARTERS[sr.admin_topic ?? ''] ?? '' : ''} />
            <div className="flex justify-end"><Button type="submit">Send reply and close</Button></div>
          </form>
        </Section>
      ) : null}

      <Section title="How it was sorted" subtitle="Every request is read and sorted as it arrives. Change the type if it got it wrong.">
        <div className="px-5 py-4 text-sm">
          {reasons.length > 0 ? (
            <ul className="mb-4 list-disc space-y-1 pl-5 text-gray-700">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          ) : <p className="mb-4 text-gray-500">No urgency or question wording found — sorted as a {CATEGORY_LABELS[sr.category ?? ''] ?? 'repair'} request.</p>}
          {isOpen ? (
            <form action={reclassifyServiceRequest.bind(null, sr.id)} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="classification">Request type</Label>
                <Select id="classification" name="classification" defaultValue={sr.request_kind === 'admin' ? `admin:${sr.admin_topic}` : `maintenance:${sr.category ?? 'general_repair'}`}>
                  <optgroup label="Repair">
                    {Object.entries(CATEGORY_LABELS).filter(([k]) => k !== 'other').map(([k, l]) => <option key={k} value={`maintenance:${k}`}>{l}</option>)}
                  </optgroup>
                  <optgroup label="Question (not a repair)">
                    {Object.entries(ADMIN_TOPIC_LABELS).map(([k, l]) => <option key={k} value={`admin:${k}`}>{l}</option>)}
                  </optgroup>
                </Select>
              </div>
              <Button type="submit" variant="secondary">Update type</Button>
            </form>
          ) : null}
        </div>
      </Section>

      {merged && merged.length > 0 ? (
        <Section title="Other reports of this issue" subtitle="Merged into this request">
          <ul className="divide-y divide-line">
            {merged.map((m: any) => (
              <li key={m.id} className="px-5 py-3 text-sm">
                <Link href={`/service-requests/${m.id}`} className="font-medium text-gray-900 hover:underline">#{m.number ?? m.id.slice(0, 8)}</Link>
                <span className="text-gray-500"> · {requester(m).name} · {date(m.created_at)}</span>
                <p className="mt-0.5 line-clamp-2 text-gray-600">{m.description}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </Workspace>
  );
}
