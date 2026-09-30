'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { notifyOwnerOfStatusChange } from '@/lib/notifications/status-change';

// Every action re-checks staff access here and again inside the SECURITY
// DEFINER RPC (portfolio + association scope), so a crafted form post cannot
// act on another company's or another manager's request.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOPICS = new Set(['account', 'documents', 'insurance', 'move', 'access', 'governance']);
const CATEGORIES = new Set(['plumbing', 'electrical', 'hvac', 'general_repair', 'common_area', 'appliance', 'pest_control', 'landscaping', 'other']);

function detailPath(id: string) {
  return `/service-requests/${id}`;
}

function failTo(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function refresh(id: string) {
  revalidatePath('/service-requests');
  revalidatePath(detailPath(id));
  revalidatePath('/portal/service-requests');
}

export async function triageServiceRequest(serviceRequestId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('triage_service_request_to_work_order', {
    p_service_request_id: serviceRequestId,
  });
  if (error || !data) {
    redirect(`/service-requests?error=${encodeURIComponent(error?.message ?? 'The work order could not be created.')}`);
  }
  revalidatePath('/service-requests');
  revalidatePath('/work-orders');
  redirect(`/work-orders/${data}`);
}

export async function acknowledgeServiceRequest(serviceRequestId: string) {
  await requireStaff();
  if (!UUID.test(serviceRequestId)) failTo('/service-requests', 'Unknown service request');
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('acknowledge_service_request', { p_id: serviceRequestId });
  if (error) failTo(detailPath(serviceRequestId), error.message);
  refresh(serviceRequestId);
  redirect(`${detailPath(serviceRequestId)}?saved=acknowledged`);
}

/** Answer the resident and close the request (non-maintenance questions, or repairs finished outside a work order). */
export async function resolveServiceRequest(serviceRequestId: string, formData: FormData) {
  await requireStaff();
  if (!UUID.test(serviceRequestId)) failTo('/service-requests', 'Unknown service request');
  const note = String(formData.get('resolution_note') ?? '').trim();
  if (!note) failTo(detailPath(serviceRequestId), 'Write the reply the resident will see');
  if (note.length > 5000) failTo(detailPath(serviceRequestId), 'Keep the reply under 5,000 characters');
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('resolve_service_request', { p_id: serviceRequestId, p_note: note });
  if (error) failTo(detailPath(serviceRequestId), error.message);
  await notifyOwnerOfStatusChange({ kind: 'service_request', id: serviceRequestId, newStatus: 'completed', message: note });
  refresh(serviceRequestId);
  redirect(`${detailPath(serviceRequestId)}?saved=resolved`);
}

export async function mergeServiceRequest(serviceRequestId: string, formData: FormData) {
  await requireStaff();
  const into = String(formData.get('into_id') ?? '');
  if (!UUID.test(serviceRequestId) || !UUID.test(into)) failTo('/service-requests', 'Unknown service request');
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('merge_service_request', { p_id: serviceRequestId, p_into: into });
  if (error) failTo(detailPath(serviceRequestId), error.message);
  const { data: merged } = await (supabase as any).from('service_requests').select('resolution_note').eq('id', serviceRequestId).maybeSingle();
  await notifyOwnerOfStatusChange({ kind: 'service_request', id: serviceRequestId, newStatus: 'merged', message: merged?.resolution_note ?? null });
  refresh(serviceRequestId);
  refresh(into);
  redirect(`${detailPath(into)}?saved=merged`);
}

export async function clearDuplicateFlag(serviceRequestId: string) {
  await requireStaff();
  if (!UUID.test(serviceRequestId)) failTo('/service-requests', 'Unknown service request');
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('clear_service_request_duplicate', { p_id: serviceRequestId });
  if (error) failTo(detailPath(serviceRequestId), error.message);
  refresh(serviceRequestId);
  redirect(`${detailPath(serviceRequestId)}?saved=not_duplicate`);
}

export async function reclassifyServiceRequest(serviceRequestId: string, formData: FormData) {
  await requireStaff();
  if (!UUID.test(serviceRequestId)) failTo('/service-requests', 'Unknown service request');
  const value = String(formData.get('classification') ?? '');
  const [kind, detail] = value.split(':');
  if (kind === 'admin' && !TOPICS.has(detail)) failTo(detailPath(serviceRequestId), 'Pick what the question is about');
  if (kind === 'maintenance' && !CATEGORIES.has(detail)) failTo(detailPath(serviceRequestId), 'Pick a repair category');
  if (kind !== 'admin' && kind !== 'maintenance') failTo(detailPath(serviceRequestId), 'Pick a request type');
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('reclassify_service_request', {
    p_id: serviceRequestId,
    p_kind: kind,
    p_topic: kind === 'admin' ? detail : null,
    p_category: kind === 'maintenance' ? detail : null,
  });
  if (error) failTo(detailPath(serviceRequestId), error.message);
  refresh(serviceRequestId);
  redirect(`${detailPath(serviceRequestId)}?saved=reclassified`);
}
