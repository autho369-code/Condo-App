'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireWorkspaceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { tenantWorkspaceUrl } from '@/lib/tenant/host';
import { RECORD_TYPES, type RecordType } from '@/lib/records/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();

const recordPath = (type: RecordType, id: string) =>
  type === 'association' ? `/associations/${id}/profile` : `/${type}s/${id}`;

/** Record type + id from the form, and the record page to return to. */
function target(fd: FormData) {
  const type = s(fd, 'entity_type') as RecordType;
  const id = s(fd, 'entity_id');
  if (!RECORD_TYPES.includes(type) || !UUID_RE.test(id)) redirect('/dashboard?error=' + encodeURIComponent('Record not found'));
  return { type, id, path: recordPath(type, id) };
}

function fail(path: string, anchor: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}#${anchor}`);
}

// Each RPC re-checks staff access and that the record belongs to the caller's company.
export async function setRecordTags(formData: FormData) {
  await requireWorkspaceStaff();
  const { type, id, path } = target(formData);
  const tags = s(formData, 'tags')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const db = (await createClient()) as any;
  const { error } = await db.rpc('set_record_tags', { p_entity_type: type, p_entity_id: id, p_tags: tags });
  if (error) fail(path, 'tags', error.message);
  revalidatePath(path);
  // The association record shows ?saved as its message text.
  redirect(`${path}?saved=${type === 'association' ? encodeURIComponent('Tags saved') : 'tags'}#tags`);
}

export async function addRecordNote(formData: FormData) {
  const me = await requireWorkspaceStaff();
  const { type, id, path } = target(formData);
  const mentions = formData
    .getAll('mention_ids')
    .map((v) => String(v))
    .filter((v) => UUID_RE.test(v));
  const appUrl = tenantWorkspaceUrl(me.portfolio?.slug, '/').replace(/\/$/, '');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('add_record_note', {
    p_entity_type: type,
    p_entity_id: id,
    p_body: s(formData, 'body'),
    p_mentions: mentions,
    p_app_url: appUrl,
  });
  if (error) fail(path, 'notes', error.message);
  revalidatePath(path);
  redirect(`${path}?saved=note#notes`);
}

export async function updateRecordNote(formData: FormData) {
  await requireWorkspaceStaff();
  const { path } = target(formData);
  const noteId = s(formData, 'note_id');
  if (!UUID_RE.test(noteId)) fail(path, 'notes', 'Note not found');
  const op = s(formData, 'op');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('update_record_note', {
    p_note_id: noteId,
    p_pinned: op === 'pin' ? true : op === 'unpin' ? false : null,
    p_archive: op === 'remove',
  });
  if (error) fail(path, 'notes', error.message);
  revalidatePath(path);
  redirect(`${path}#notes`);
}
