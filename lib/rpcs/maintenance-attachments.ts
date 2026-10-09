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
// Vendors can't add files once the job is finished (matches the vendor page).
const VENDOR_CLOSED = new Set(['completed', 'closed', 'cancelled', 'billed']);

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

/** Every tenant identity linked to the caller (one login can rent several units). */
async function myTenantIds(db: any): Promise<string[]> {
  const { data } = await db.rpc('current_tenant_ids');
  return Array.isArray(data) ? data.map((row: any) => (typeof row === 'string' ? row : row?.current_tenant_ids)).filter(Boolean) : [];
}

/**
 * Staff power applies only inside the caller's own company and, for an
 * association-scoped manager, their associations. A global staff flag is not
 * enough: one login can be staff at one company and an owner or vendor at
 * another, and RLS shows them that other company's records in that role.
 */
async function staffCanManage(db: any, portfolioId: string | null, associationId: string | null): Promise<boolean> {
  const { data, error } = associationId
    ? await db.rpc('can_manage_association', { p_association_id: associationId })
    : await db.rpc('can_access_portfolio', { p_id: portfolioId });
  return !error && data === true;
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
    if (isStaff && await staffCanManage(db, sr.portfolio_id, sr.association_id)) role = 'staff';
    else if ((me.owner_id && (sr.homeowner_id === me.owner_id || sr.owner_id === me.owner_id))
      || (sr.tenant_id && (await myTenantIds(db)).includes(sr.tenant_id))) {
      if (sr.status !== 'open' && sr.status !== 'waiting') return { error: 'This request is closed' };
      role = 'resident';
    } else return { error: 'You cannot add files to this request' };
    return { userId: me.auth_user_id, parent: { kind, id, portfolioId: sr.portfolio_id, associationId: sr.association_id, serviceRequestId: sr.id, workOrderId: null, role } };
  }

  const { data: wo } = await db.from('work_orders')
    .select('id, status, portfolio_id, association_id, service_request_id, vendor_id, associations(portfolio_id)')
    .eq('id', id).is('archived_at', null).maybeSingle();
  if (!wo) return { error: 'Work order not found' };
  let role: Parent['role'];
  if (isStaff && await staffCanManage(db, wo.portfolio_id ?? wo.associations?.portfolio_id ?? null, wo.association_id)) role = 'staff';
  else if (wo.vendor_id && (me.vendor_ids ?? []).includes(wo.vendor_id)) {
    if (VENDOR_CLOSED.has(wo.status)) return { error: 'This work order is closed' };
    role = 'vendor';
  }
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

/**
 * The real type of a stored file, from its first bytes. The storage mimetype
 * comes from the client's upload header, so it can't be trusted for deciding
 * what residents may see.
 */
async function sniffStoredType(svc: any, path: string): Promise<string | null> {
  const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(path, 60);
  if (!signed?.signedUrl) return null;
  const res = await fetch(signed.signedUrl, { headers: { Range: 'bytes=0-31' } });
  if (!res.ok) return null;
  const b = new Uint8Array(await res.arrayBuffer()).slice(0, 32);
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && ['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1', 'hevc'].includes(ascii(8, 12))) return 'image/heic';
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  return null;
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
  // The bucket allows larger objects than we do, and the size claimed when
  // signing isn't binding — check what was actually stored.
  const storedSize = Number(stored.metadata?.size ?? NaN);
  if (!Number.isFinite(storedSize) || storedSize <= 0 || storedSize > MAX_BYTES || storedSize !== Number(file.size)) {
    await svc.storage.from(BUCKET).remove([file.path]);
    return { error: `"${file.name}" is over ${MAX_BYTES / 1048576} MB or didn't upload completely` };
  }

  const actualType = await sniffStoredType(svc, file.path);
  if (!actualType) {
    await svc.storage.from(BUCKET).remove([file.path]);
    return { error: `"${file.name}" is not a JPG, PNG, HEIC, WebP photo or a PDF` };
  }

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
    content_type: actualType,
    size_bytes: storedSize,
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
  // Same access rule as uploading (staff of this record's company, or the
  // resident / vendor on it while the job is open).
  const access = row.work_order_id
    ? await resolveParent('work_order', row.work_order_id)
    : await resolveParent('service_request', row.service_request_id);
  if ('error' in access) return { error: access.error === 'This request is closed' || access.error === 'This work order is closed' ? 'Files on a closed job can only be removed by the management team' : access.error };
  if (access.parent.role !== 'staff' && row.uploaded_by !== me.auth_user_id) return { error: 'You can only remove files you added' };
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
