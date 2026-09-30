'use server';

// Photos and files on service requests and work orders.
//
// Upload flow (same as violation photos): the browser asks for a signed
// upload URL, sends the file straight to private storage, then asks us to
// record it. Both server steps re-read the parent record with the CALLER'S
// RLS-scoped client, so a user can only attach to a request or work order
// they can already see, and only in their own role:
//   - staff: any request or work order in scope
//   - residents (owners and tenants): their own open service request
//   - vendors: a work order assigned to them
// Rows are written with the service client (the table has no write policies).

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth/me';
import { isScopedStoragePath } from '@/lib/security/storage-paths';

const BUCKET = 'association-documents';
const NAMESPACE = 'maintenance';
const MAX_FILES = 12;
const MAX_BYTES = 20 * 1024 * 1024;
// Must stay within the association-documents bucket's allowed MIME types.
const ALLOWED_TYPE = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MaintenanceParentKind = 'service_request' | 'work_order';

interface Parent {
  kind: MaintenanceParentKind;
  id: string;
  portfolioId: string;
  associationId: string | null;
  serviceRequestId: string | null;
  workOrderId: string | null;
  role: 'staff' | 'resident' | 'vendor';
}

async function resolveParent(kind: MaintenanceParentKind, id: string): Promise<{ error: string } | { parent: Parent; userId: string }> {
  if (!UUID.test(id) || (kind !== 'service_request' && kind !== 'work_order')) return { error: 'Unknown record' };
  const me = await getMe();
  if (!me.auth_user_id) return { error: 'Not signed in' };
  const isStaff = me.is_staff || me.is_platform_operator || me.is_company_admin;
  const db = (await createClient()) as any;

  if (kind === 'service_request') {
    const { data: sr } = await db.from('service_requests')
      .select('id, portfolio_id, association_id, status, homeowner_id, owner_id, tenant_id')
      .eq('id', id).is('archived_at', null).maybeSingle();
    if (!sr) return { error: 'Request not found' };
    let role: Parent['role'];
    if (isStaff) role = 'staff';
    else if ((me.owner_id && (sr.homeowner_id === me.owner_id || sr.owner_id === me.owner_id))
      || (me.tenant_id && sr.tenant_id === me.tenant_id)) {
      if (sr.status !== 'open' && sr.status !== 'waiting') return { error: 'This request is closed' };
      role = 'resident';
    } else return { error: 'You cannot add files to this request' };
    return { userId: me.auth_user_id, parent: { kind, id, portfolioId: sr.portfolio_id, associationId: sr.association_id, serviceRequestId: sr.id, workOrderId: null, role } };
  }

  const { data: wo } = await db.from('work_orders')
    .select('id, portfolio_id, association_id, service_request_id, vendor_id, associations(portfolio_id)')
    .eq('id', id).is('archived_at', null).maybeSingle();
  if (!wo) return { error: 'Work order not found' };
  let role: Parent['role'];
  if (isStaff) role = 'staff';
  else if (me.vendor_id && wo.vendor_id === me.vendor_id) role = 'vendor';
  else return { error: 'You cannot add files to this work order' };
  const portfolioId = wo.portfolio_id ?? wo.associations?.portfolio_id;
  if (!portfolioId) return { error: 'Work order has no company' };
  return { userId: me.auth_user_id, parent: { kind, id, portfolioId, associationId: wo.association_id, serviceRequestId: wo.service_request_id, workOrderId: wo.id, role } };
}

async function countFor(svc: any, parent: Parent) {
  const column = parent.kind === 'service_request' ? 'service_request_id' : 'work_order_id';
  let query = svc.from('maintenance_attachments').select('id', { count: 'exact', head: true }).eq(column, parent.id);
  if (parent.kind === 'service_request') query = query.is('work_order_id', null);
  const { count } = await query;
  return count ?? 0;
}

/** Step 1: a signed URL the browser uploads one file to. */
export async function createMaintenanceUpload(
  kind: MaintenanceParentKind,
  id: string,
  file: { name: string; size: number; type: string },
): Promise<{ error?: string; path?: string; token?: string }> {
  const resolved = await resolveParent(kind, id);
  if ('error' in resolved) return { error: resolved.error };
  if (!file?.name) return { error: 'Missing file name' };
  if (!file.size || file.size <= 0) return { error: `"${file.name}" is empty` };
  if (file.size > MAX_BYTES) return { error: `"${file.name}" is over ${MAX_BYTES / 1048576} MB` };
  if (!ALLOWED_TYPE.test(file.type || '')) return { error: `"${file.name}" is not a JPG, PNG, HEIC, WebP photo or a PDF` };
  const svc = createServiceClient() as any;
  if ((await countFor(svc, resolved.parent)) >= MAX_FILES) return { error: `Limit of ${MAX_FILES} files reached` };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'file';
  const path = `${NAMESPACE}/${id}/${Date.now()}-${safeName}`;
  const { data, error } = await svc.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) return { error: error?.message ?? 'Could not authorize the upload' };
  return { path, token: data.token };
}

/** Step 2: record a file the browser finished uploading. */
export async function recordMaintenanceUpload(
  kind: MaintenanceParentKind,
  id: string,
  file: { path: string; name: string; size: number; type: string },
): Promise<{ error?: string; ok?: boolean }> {
  const resolved = await resolveParent(kind, id);
  if ('error' in resolved) return { error: resolved.error };
  const { parent, userId } = resolved;
  if (!isScopedStoragePath(file?.path, NAMESPACE, id)) return { error: 'Invalid file reference' };
  const svc = createServiceClient() as any;

  // The object must really exist (the signed URL may never have been used).
  const folder = file.path.slice(0, file.path.lastIndexOf('/'));
  const objectName = file.path.slice(file.path.lastIndexOf('/') + 1);
  const { data: listed } = await svc.storage.from(BUCKET).list(folder, { search: objectName, limit: 1 });
  const stored = (listed ?? []).find((o: any) => o.name === objectName);
  if (!stored) return { error: 'Upload not found — try again' };

  const { data: existing } = await svc.from('maintenance_attachments').select('id').eq('file_path', file.path).maybeSingle();
  if (existing) return { ok: true };
  if ((await countFor(svc, parent)) >= MAX_FILES) {
    await svc.storage.from(BUCKET).remove([file.path]);
    return { error: `Limit of ${MAX_FILES} files reached` };
  }

  const { error } = await svc.from('maintenance_attachments').insert({
    portfolio_id: parent.portfolioId,
    association_id: parent.associationId,
    service_request_id: parent.serviceRequestId,
    work_order_id: parent.workOrderId,
    file_name: String(file.name || objectName).slice(0, 255),
    file_path: file.path,
    content_type: stored.metadata?.mimetype ?? file.type ?? null,
    size_bytes: stored.metadata?.size ?? file.size ?? null,
    uploaded_by: userId,
    uploader_role: parent.role,
  });
  if (error) {
    await svc.storage.from(BUCKET).remove([file.path]);
    return { error: error.message };
  }
  revalidateParent(parent);
  return { ok: true };
}

/** Staff remove any file; others remove only what they uploaded themselves. */
export async function removeMaintenanceAttachment(attachmentId: string): Promise<{ error?: string; ok?: boolean }> {
  if (!UUID.test(attachmentId)) return { error: 'Unknown file' };
  const me = await getMe();
  if (!me.auth_user_id) return { error: 'Not signed in' };
  const db = (await createClient()) as any;
  const { data: row } = await db.from('maintenance_attachments')
    .select('id, file_path, uploaded_by, service_request_id, work_order_id')
    .eq('id', attachmentId).maybeSingle();
  if (!row) return { error: 'File not found' };
  const isStaff = me.is_staff || me.is_platform_operator || me.is_company_admin;
  if (!isStaff && row.uploaded_by !== me.auth_user_id) return { error: 'You can only remove files you added' };
  const svc = createServiceClient() as any;
  const { error } = await svc.from('maintenance_attachments').delete().eq('id', attachmentId);
  if (error) return { error: error.message };
  await svc.storage.from(BUCKET).remove([row.file_path]);
  revalidatePath('/service-requests', 'layout');
  revalidatePath('/work-orders', 'layout');
  revalidatePath('/portal/service-requests');
  revalidatePath('/resident/requests');
  revalidatePath('/vendor/work-orders', 'layout');
  return { ok: true };
}

function revalidateParent(parent: Parent) {
  if (parent.serviceRequestId) revalidatePath(`/service-requests/${parent.serviceRequestId}`);
  if (parent.workOrderId) {
    revalidatePath(`/work-orders/${parent.workOrderId}`);
    revalidatePath(`/vendor/work-orders/${parent.workOrderId}`);
  }
  revalidatePath('/portal/service-requests');
  revalidatePath('/resident/requests');
}
