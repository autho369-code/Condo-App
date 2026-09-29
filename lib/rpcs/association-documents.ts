'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { OPERATING_TYPES } from '@/lib/associations/operating-docs';
import { folderForDocType, SHARE_SCOPES, type ShareScope } from '@/lib/associations/document-sharing';
import { isScopedStoragePath } from '@/lib/security/storage-paths';

// Storage writes use the service client, so every action first confirms the
// caller manages the association (can_manage_association) with their own
// session. Metadata edits and deletes go through audited RPCs.

const BUCKET = 'association-documents';
const MAX_BYTES = 10 * 1024 * 1024;
const REF_RE = /^[a-z0-9-]{1,80}$/i;
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();

function back(fd: FormData) {
  const ref = s(fd, 'association_ref');
  const folder = s(fd, 'return_folder');
  const base = `/associations/${REF_RE.test(ref) ? ref : s(fd, 'association_id')}/documents`;
  return folder ? `${base}?folder=${encodeURIComponent(folder)}` : base;
}
function go(path: string, key: 'error' | 'saved', msg: string): never {
  revalidatePath(path.split('?')[0]);
  redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`);
}
async function assertManages(associationId: string, to: string) {
  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('can_manage_association', { p_association_id: associationId });
  if (error || data !== true) go(to, 'error', 'You do not manage this association.');
  return db;
}

export async function uploadAssociationDocument(formData: FormData) {
  const me = await requireStaff();
  const to = back(formData);
  const associationId = s(formData, 'association_id');
  const db = await assertManages(associationId, to);

  const docType = s(formData, 'doc_type') || 'association_document';
  if (![...OPERATING_TYPES, 'association_document'].includes(docType)) go(to, 'error', 'Choose a valid document type.');
  const scope = (s(formData, 'share_scope') || (OPERATING_TYPES.includes(docType) ? 'owners' : 'staff')) as ShareScope;
  if (!SHARE_SCOPES.includes(scope)) go(to, 'error', 'Choose who can see this document.');
  const folder = (s(formData, 'folder') || folderForDocType(docType) || '').slice(0, 60) || null;
  const description = s(formData, 'description').slice(0, 500) || null;

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) go(to, 'error', 'Choose a file to upload.');
  if (file.size > MAX_BYTES) go(to, 'error', 'Each document must be under 10 MB — upload files one at a time.');

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
  const sub = OPERATING_TYPES.includes(docType) ? 'operating' : 'files';
  const path = `associations/${associationId}/${sub}/${docType}-${Date.now()}-${safeName}`;
  const svc = createServiceClient() as any;
  const { error: upErr } = await svc.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (upErr) go(to, 'error', `Upload failed: ${upErr.message}`);

  const { error } = await db.from('documents').insert({
    entity_type: 'association',
    entity_id: associationId,
    doc_type: docType,
    file_name: file.name.slice(0, 200),
    file_url: path,
    folder,
    share_scope: scope,
    description,
    uploaded_at: new Date().toISOString(),
    uploaded_by: me.auth_user_id,
  });
  if (error) {
    // Roll the object back so a rejected row never leaves an orphaned file.
    await svc.storage.from(BUCKET).remove([path]);
    go(to, 'error', `Could not save the document: ${error.message}`);
  }
  revalidatePath('/onboard');
  go(to, 'saved', `Uploaded ${file.name}.`);
}

export async function updateAssociationDocument(formData: FormData) {
  await requireStaff();
  const to = back(formData);
  const scope = s(formData, 'share_scope');
  if (!SHARE_SCOPES.includes(scope as ShareScope)) go(to, 'error', 'Choose who can see this document.');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('update_association_document', {
    p_document_id: s(formData, 'document_id'),
    p_folder: s(formData, 'folder') || null,
    p_share_scope: scope,
    p_description: s(formData, 'description') || null,
  });
  if (error) go(to, 'error', error.message);
  go(to, 'saved', 'Document updated.');
}

export async function deleteAssociationDocument(formData: FormData) {
  await requireStaff();
  const to = back(formData);
  if (formData.get('confirm') !== 'on') go(to, 'error', 'Tick the box to confirm the deletion.');
  const associationId = s(formData, 'association_id');
  const db = (await createClient()) as any;
  const { data: path, error } = await db.rpc('delete_association_document', { p_document_id: s(formData, 'document_id') });
  if (error) go(to, 'error', error.message);
  // Only remove objects that live under this association's own prefix.
  if (typeof path === 'string' && isScopedStoragePath(path, 'associations', associationId)) {
    const svc = createServiceClient() as any;
    await svc.storage.from(BUCKET).remove([path]);
  }
  go(to, 'saved', 'Document deleted.');
}
