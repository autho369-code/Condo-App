import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Alert, Badge } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';
import { OfflineInspectionCapture } from './offline-inspection-capture';

export const dynamic = 'force-dynamic';

function bounce(id: string, key: 'error' | 'saved', message: string) {
  redirect(`/inspections/${id}?${key}=${encodeURIComponent(message)}`);
}

export default async function InspectionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const [{ data: inspection }, { data: findings }] = await Promise.all([
    db.from('inspections').select('*, associations(name), units(unit_number), vendors:inspector_vendor_id(name), profiles:inspector_user_id(full_name, email)').eq('id', id).maybeSingle(),
    db.from('inspection_items').select('*, work_orders(id, number, title, status)').eq('inspection_id', id).order('sort_order').order('created_at'),
  ]);
  if (!inspection) notFound();
  const findingIds = (findings ?? []).map((finding: any) => finding.id);
  const { data: findingEvents } = findingIds.length
    ? await db.from('inspection_finding_events').select('inspection_item_id, action, note, work_order_id, created_at').in('inspection_item_id', findingIds).order('created_at', { ascending: false })
    : { data: [] };
  const eventsByFinding = new Map<string, any[]>();
  for (const event of findingEvents ?? []) {
    const events = eventsByFinding.get(event.inspection_item_id) ?? [];
    events.push(event);
    eventsByFinding.set(event.inspection_item_id, events);
  }

  async function updateStatus(formData: FormData) {
    'use server';
    await requireStaff();
    const supabase = await createClient();
    const inspectionId = String(formData.get('inspection_id') ?? '');
    const status = String(formData.get('status') ?? 'scheduled');
    const { error } = await (supabase as any).from('inspections').update({
      status,
      completed_date: status === 'completed' ? new Date().toISOString().slice(0, 10) : null,
      notes: String(formData.get('notes') ?? '').trim() || null,
    }).eq('id', inspectionId);
    if (error) bounce(inspectionId, 'error', error.message);
    revalidatePath(`/inspections/${inspectionId}`);
    bounce(inspectionId, 'saved', 'Inspection status updated.');
  }

  async function addFinding(formData: FormData) {
    'use server';
    const current = await requireStaff();
    const supabase = await createClient();
    const inspectionId = String(formData.get('inspection_id') ?? '');
    const issue = String(formData.get('issue') ?? '').trim();
    if (!issue) bounce(inspectionId, 'error', 'Finding description is required.');
    const { error } = await (supabase as any).from('inspection_items').insert({
      inspection_id: inspectionId,
      area: String(formData.get('area') ?? '').trim() || null,
      issue,
      severity: String(formData.get('severity') ?? 'minor'),
      captured_at: new Date().toISOString(),
      captured_by: current.auth_user_id,
    });
    if (error) bounce(inspectionId, 'error', error.message);
    revalidatePath(`/inspections/${inspectionId}`);
    bounce(inspectionId, 'saved', 'Finding added.');
  }

  async function resolveFinding(formData: FormData) {
    'use server';
    await requireStaff();
    const supabase = await createClient();
    const inspectionId = String(formData.get('inspection_id') ?? '');
    const findingId = String(formData.get('finding_id') ?? '');
    const resolved = formData.get('resolved') === 'true';
    const { error } = await (supabase as any).from('inspection_items').update({
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
      resolution_notes: String(formData.get('resolution_notes') ?? '').trim() || null,
    }).eq('id', findingId).eq('inspection_id', inspectionId);
    if (error) bounce(inspectionId, 'error', error.message);
    revalidatePath(`/inspections/${inspectionId}`);
    redirect(`/inspections/${inspectionId}`);
  }

  async function createRemediation(formData: FormData) {
    'use server';
    const current = await requireStaff();
    const supabase = await createClient();
    const inspectionId = String(formData.get('inspection_id') ?? '');
    const findingId = String(formData.get('finding_id') ?? '');
    const { data: inspectionRow } = await (supabase as any).from('inspections').select('portfolio_id, association_id, unit_id').eq('id', inspectionId).maybeSingle();
    const { data: finding } = await (supabase as any).from('inspection_items').select('issue, area, severity, work_order_id').eq('id', findingId).eq('inspection_id', inspectionId).maybeSingle();
    if (!inspectionRow || !finding) bounce(inspectionId, 'error', 'Inspection finding was not found.');
    if (finding.work_order_id) redirect(`/work-orders/${finding.work_order_id}`);
    const priority = finding.severity === 'critical' ? 'emergency' : finding.severity === 'major' ? 'high' : 'normal';
    const { data: workOrder, error: createError } = await (supabase as any).from('work_orders').insert({
      portfolio_id: inspectionRow.portfolio_id,
      association_id: inspectionRow.association_id,
      unit_id: inspectionRow.unit_id,
      title: `Inspection remediation: ${String(finding.issue).slice(0, 150)}`,
      description: `${finding.area ? `Area: ${finding.area}\n\n` : ''}${finding.issue}`,
      category: 'general_repair',
      priority,
      status: 'new',
      requested_by: 'Inspection finding',
      created_by: current.auth_user_id,
    }).select('id').single();
    if (createError || !workOrder) bounce(inspectionId, 'error', createError?.message ?? 'Could not create remediation work order.');
    const { error: linkError } = await (supabase as any).from('inspection_items').update({ work_order_id: workOrder.id }).eq('id', findingId).eq('inspection_id', inspectionId);
    if (linkError) bounce(inspectionId, 'error', `Work order created, but linking failed: ${linkError.message}`);
    revalidatePath(`/inspections/${inspectionId}`);
    redirect(`/work-orders/${workOrder.id}`);
  }

  const unresolved = (findings ?? []).filter((finding: any) => !finding.resolved);
  const critical = unresolved.filter((finding: any) => ['major', 'critical'].includes(finding.severity));

  return (
    <Workspace header={<WorkspaceHeader eyebrow={<><Link href="/inspections" className="hover:text-gray-700">Inspections</Link> · {inspection.associations?.name}</>} title={inspection.inspection_type ?? 'Property inspection'} subtitle={`${inspection.units?.unit_number ? `Unit ${inspection.units.unit_number}` : 'Common area / property-wide'} · scheduled ${date(inspection.scheduled_date)}`} actions={<><Badge status={inspection.status} /><Link href={`/inspections/${id}/field`}><Button variant="secondary">Open field mode</Button></Link></>} />}>
      {sp.error && <Alert className="mb-5" title="Could not update inspection">{sp.error}</Alert>}
      {sp.saved && <Alert className="mb-5" tone="success">{sp.saved}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200/70 bg-white p-4"><div className="text-xs text-gray-500">Findings</div><div className="mt-1 text-2xl font-semibold tabular-nums">{(findings ?? []).length}</div></div>
        <div className="rounded-2xl border border-gray-200/70 bg-white p-4"><div className="text-xs text-gray-500">Unresolved</div><div className="mt-1 text-2xl font-semibold tabular-nums">{unresolved.length}</div></div>
        <div className="rounded-2xl border border-gray-200/70 bg-white p-4"><div className="text-xs text-gray-500">Major / critical</div><div className="mt-1 text-2xl font-semibold tabular-nums">{critical.length}</div></div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Section title="Findings and remediation" subtitle="Every issue can be resolved in place or promoted into a linked work order." padded>
          {(findings ?? []).length ? <div className="space-y-4">{(findings ?? []).map((finding: any) => {
            const workOrder = Array.isArray(finding.work_orders) ? finding.work_orders[0] : finding.work_orders;
            return <div key={finding.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-medium text-gray-900">{finding.issue}</div><div className="mt-1 text-xs text-gray-500">{finding.area ?? 'Area not specified'} · captured {date(finding.captured_at ?? finding.created_at)}</div></div><div className="flex gap-2"><Badge status={finding.severity}>{finding.severity}</Badge><Badge status={finding.resolved ? 'resolved' : 'open'} /></div></div>
              {workOrder && <p className="mt-3 text-sm"><Link href={`/work-orders/${workOrder.id}`} className="font-medium text-gray-700 hover:text-blue-700">Remediation #{workOrder.number ?? workOrder.id.slice(0, 8)} · {workOrder.title}</Link></p>}
              {(eventsByFinding.get(finding.id) ?? []).length > 0 && <div className="mt-3 space-y-1 text-xs text-gray-500">{(eventsByFinding.get(finding.id) ?? []).slice(0, 4).map((event: any, index: number) => <div key={`${event.created_at}-${index}`}><span className="font-medium capitalize text-gray-700">{event.action.replaceAll('_', ' ')}</span> · {date(event.created_at)}{event.note ? ` · ${event.note}` : ''}</div>)}</div>}
              <form action={resolveFinding} className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row"><input type="hidden" name="inspection_id" value={id} /><input type="hidden" name="finding_id" value={finding.id} /><input type="hidden" name="resolved" value={finding.resolved ? 'false' : 'true'} /><Input name="resolution_notes" defaultValue={finding.resolution_notes ?? ''} placeholder="Resolution evidence or follow-up note" /><Button type="submit" variant="secondary">{finding.resolved ? 'Reopen' : 'Resolve'}</Button>{!workOrder && <Button type="submit" formAction={createRemediation}>Create work order</Button>}</form>
            </div>;
          })}</div> : <p className="text-sm text-gray-500">No findings have been recorded.</p>}

          <form action={addFinding} className="mt-5 grid gap-3 border-t border-gray-100 pt-5 sm:grid-cols-2">
            <input type="hidden" name="inspection_id" value={id} />
            <Field label="Area"><Input name="area" placeholder="Roof, pool deck, mechanical room" /></Field>
            <Field label="Severity"><Select name="severity" defaultValue="minor"><option value="info">Information</option><option value="minor">Minor</option><option value="moderate">Moderate</option><option value="major">Major</option><option value="critical">Critical</option></Select></Field>
            <Field label="Finding" className="sm:col-span-2"><Textarea name="issue" required /></Field>
            <Button type="submit" className="sm:w-fit">Add finding</Button>
          </form>
        </Section>

        <div>
          <Section title="Inspection controls" padded>
            <form action={updateStatus} className="space-y-4"><input type="hidden" name="inspection_id" value={id} /><Field label="Status"><Select name="status" defaultValue={inspection.status}><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></Select></Field><Field label="Notes"><Textarea name="notes" defaultValue={inspection.notes ?? ''} /></Field><Button type="submit">Save inspection</Button></form>
          </Section>
          <Section title="Field capture" subtitle="Queue findings while disconnected; Portier syncs them idempotently when the connection returns." padded><OfflineInspectionCapture inspectionId={id} compact /></Section>
        </div>
      </div>
    </Workspace>
  );
}
