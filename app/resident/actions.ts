'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireTenant } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isScopedStoragePath } from '@/lib/security/storage-paths';

const REQUEST_PRIORITIES = new Set(['low', 'normal', 'high', 'emergency']);
const RESIDENT_DOCUMENT_BUCKET = 'association-documents';
const MAX_RESIDENT_DOCUMENT_BYTES = 25 * 1024 * 1024;
const RESIDENT_DOCUMENT_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'heic']);

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

export async function submitResidentRequest(formData: FormData) {
  await requireTenant();
  const unitId = textValue(formData, 'unit_id');
  const description = textValue(formData, 'description');
  const requestedPriority = textValue(formData, 'priority');
  const priority = REQUEST_PRIORITIES.has(requestedPriority) ? requestedPriority : 'normal';
  const accessNotes = textValue(formData, 'access_notes');

  if (!unitId) redirect('/resident/requests?error=' + encodeURIComponent('Select a unit.'));
  if (description.length < 10) {
    redirect('/resident/requests?error=' + encodeURIComponent('Please describe the issue in at least one sentence.'));
  }

  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('submit_tenant_service_request', {
    p_unit_id: unitId,
    p_description: description,
    p_priority: priority,
    p_permission_to_enter: formData.get('permission_to_enter') === 'on',
    p_access_notes: accessNotes || null,
  });
  if (error || !data) {
    redirect('/resident/requests?error=' + encodeURIComponent(error?.message ?? 'The request could not be submitted.'));
  }

  revalidatePath('/resident');
  revalidatePath('/resident/requests');
  redirect(`/resident/requests?submitted=${encodeURIComponent(String(data))}`);
}

export async function cancelResidentRequest(serviceRequestId: string) {
  await requireTenant();
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('cancel_tenant_service_request', {
    p_service_request_id: serviceRequestId,
  });
  if (error || data !== true) {
    redirect('/resident/requests?error=' + encodeURIComponent(error?.message ?? 'This request can no longer be cancelled.'));
  }
  revalidatePath('/resident');
  revalidatePath('/resident/requests');
  redirect('/resident/requests?cancelled=1');
}

export async function updateResidentProfile(formData: FormData) {
  const me = await requireTenant();
  const tenantId = textValue(formData, 'tenant_id');
  if (!tenantId || !me.tenant_id) redirect('/resident/profile?error=' + encodeURIComponent('Resident record not found.'));

  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('update_tenant_portal_profile', {
    p_tenant_id: tenantId,
    p_phone: textValue(formData, 'phone') || null,
    p_emergency_contact_name: textValue(formData, 'emergency_contact_name') || null,
    p_emergency_contact_phone: textValue(formData, 'emergency_contact_phone') || null,
    p_insurance_policy_number: textValue(formData, 'insurance_policy_number') || null,
    p_insurance_expiration: textValue(formData, 'insurance_expiration') || null,
  });
  if (error || data !== true) {
    redirect('/resident/profile?error=' + encodeURIComponent(error?.message ?? 'Profile could not be saved.'));
  }
  revalidatePath('/resident');
  revalidatePath('/resident/profile');
  redirect('/resident/profile?saved=1');
}

export async function sendResidentMessage(formData: FormData) {
  await requireTenant();
  const subject = textValue(formData, 'subject');
  const body = textValue(formData, 'body');
  const requestKey = textValue(formData, 'request_key') || randomUUID();
  if (subject.length < 2 || body.length < 2) {
    redirect('/resident/communications?error=' + encodeURIComponent('Enter both a subject and message.'));
  }

  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('submit_tenant_message', {
    p_subject: subject,
    p_body: body,
    p_idempotency_key: requestKey,
  });
  if (error || !data) {
    redirect('/resident/communications?error=' + encodeURIComponent(error?.message ?? 'The message could not be sent.'));
  }
  revalidatePath('/resident/communications');
  redirect('/resident/communications?sent=1');
}

function safeFileName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180);
}

export async function createResidentInsuranceUpload(
  fileName: string,
  fileSize: number,
): Promise<{ error?: string; path?: string; token?: string }> {
  const me = await requireTenant();
  if (!me.tenant_id) return { error: 'Resident record not found.' };
  const normalized = safeFileName(fileName);
  const extension = normalized.split('.').pop()?.toLowerCase() ?? '';
  if (!normalized || !RESIDENT_DOCUMENT_EXTENSIONS.has(extension)) {
    return { error: 'Upload a PDF, JPG, PNG, WebP, or HEIC document.' };
  }
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) return { error: 'The selected file is empty.' };
  if (fileSize > MAX_RESIDENT_DOCUMENT_BYTES) return { error: 'Documents must be 25 MB or smaller.' };

  const path = `tenants/${me.tenant_id}/insurance/${randomUUID()}-${normalized}`;
  const service = createServiceClient() as any;
  const { data, error } = await service.storage.from(RESIDENT_DOCUMENT_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) return { error: error?.message ?? 'Could not authorize the upload.' };
  return { path, token: data.token };
}

export async function saveResidentInsuranceDocument(input: {
  tenantId: string;
  path: string;
  policyNumber?: string | null;
  expirationDate?: string | null;
}): Promise<{ error?: string; ok?: boolean }> {
  const me = await requireTenant();
  if (!me.auth_user_id || !me.tenant_id || input.tenantId !== me.tenant_id) return { error: 'Resident record not found.' };
  const storageSegments = input.path.split('/');
  const extension = storageSegments.at(-1)?.split('.').pop()?.toLowerCase() ?? '';
  if (
    !isScopedStoragePath(input.path, 'tenants', me.tenant_id)
    || storageSegments.length !== 4
    || storageSegments[2] !== 'insurance'
    || !RESIDENT_DOCUMENT_EXTENSIONS.has(extension)
  ) {
    return { error: 'Invalid insurance document reference.' };
  }
  if (input.expirationDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.expirationDate)) {
    return { error: 'Enter a valid expiration date.' };
  }
  if ((input.policyNumber ?? '').length > 200) return { error: 'Policy number is too long.' };

  const service = createServiceClient() as any;
  const reject = async (message: string) => {
    await service.storage.from(RESIDENT_DOCUMENT_BUCKET).remove([input.path]);
    return { error: message };
  };
  const { data: objectInfo, error: objectError } = await service.storage.from(RESIDENT_DOCUMENT_BUCKET).info(input.path);
  if (objectError || !objectInfo) return { error: 'The uploaded document could not be verified.' };
  const storedSize = Number(objectInfo.metadata?.size ?? objectInfo.metadata?.contentLength);
  if (!Number.isFinite(storedSize) || storedSize <= 0 || storedSize > MAX_RESIDENT_DOCUMENT_BYTES) {
    return reject('The uploaded document is empty, too large, or could not be verified safely.');
  }

  const { data: updated, error } = await service.from('tenants').update({
    insurance_document_url: input.path,
    insurance_policy_number: input.policyNumber?.trim() || null,
    insurance_expiration: input.expirationDate || null,
    updated_at: new Date().toISOString(),
  }).eq('id', me.tenant_id)
    .eq('auth_user_id', me.auth_user_id)
    .eq('portal_activated', true)
    .eq('status', 'active')
    .is('archived_at', null)
    .select('id')
    .maybeSingle();
  if (error || !updated) return reject(error?.message ?? 'Insurance document could not be saved.');

  revalidatePath('/resident');
  revalidatePath('/resident/profile');
  return { ok: true };
}
