'use server';

// Form templates (Communication → Forms). Staff create, edit and archive
// forms; a form can carry an uploaded file (private storage, signed links)
// or an https link. Every action re-checks staff access in its own body and
// reads the form through the caller's RLS-scoped client before changing it,
// so a form id from the request can only reach the caller's own portfolio.

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { FORMS_BUCKET } from '@/lib/forms/files';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUDIENCES = new Set(['homeowner', 'vendor', 'internal']);
const MAX_BYTES = 10 * 1024 * 1024;
// Within the association-documents bucket's allowed MIME types.
const TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

function fail(path: string, msg: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`);
}

export async function saveFormTemplate(formData: FormData) {
  const me = await requireStaff();
  const id = str(formData, 'id');
  if (id && !UUID.test(id)) fail('/forms', 'Invalid form.');
  const back = id ? `/forms/${id}` : '/forms/new';

  const portfolioId = me.portfolio?.id;
  if (!portfolioId) fail(back, 'Your account is not linked to a management company.');

  const name = str(formData, 'name');
  if (!name || name.length > 200) fail(back, 'Enter a form name (up to 200 characters).');
  const audience = str(formData, 'audience') || 'homeowner';
  if (!AUDIENCES.has(audience)) fail(back, 'Choose who the form is for.');
  const fileUrl = str(formData, 'file_url') || null;
  if (fileUrl && !/^https:\/\/[^\s]+$/i.test(fileUrl)) fail(back, 'A form link must start with https://');

  const db = (await createClient()) as any;
  let existing: { id: string; portfolio_id: string; file_path: string | null } | null = null;
  if (id) {
    const { data } = await db.from('form_templates').select('id, portfolio_id, file_path').eq('id', id).is('archived_at', null).maybeSingle();
    if (!data) fail('/forms', 'That form is unavailable or outside your access.');
    existing = data;
  }
  const targetPortfolio = existing?.portfolio_id ?? portfolioId!;

  // Optional new file.
  const file = formData.get('file');
  let upload: { path: string; name: string } | null = null;
  if (file && typeof file === 'object' && 'size' in file && file.size > 0) {
    const f = file as File;
    const ext = TYPES[f.type];
    if (!ext) fail(back, 'Upload a PDF, Word document, PNG or JPEG.');
    if (f.size > MAX_BYTES) fail(back, 'Files can be up to 10 MB.');
    const path = `forms/${targetPortfolio}/${randomUUID()}.${ext}`;
    const { error: upErr } = await (createServiceClient() as any).storage
      .from(FORMS_BUCKET)
      .upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type, upsert: false });
    if (upErr) fail(back, `The file could not be uploaded: ${upErr.message}`);
    upload = { path, name: (f.name || `form.${ext}`).slice(0, 200) };
  }
  const removeFile = str(formData, 'remove_file') === '1';

  const values: Record<string, unknown> = {
    name,
    description: str(formData, 'description') || null,
    form_type: str(formData, 'form_type') || null,
    audience,
    file_url: fileUrl,
    active: id ? str(formData, 'active') === '1' : true,
  };
  if (upload) Object.assign(values, { file_path: upload.path, file_name: upload.name });
  else if (removeFile) Object.assign(values, { file_path: null, file_name: null });

  const { data: saved, error } = id
    ? await db.from('form_templates').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).select('id').maybeSingle()
    : await db.from('form_templates').insert({ ...values, portfolio_id: portfolioId }).select('id').maybeSingle();
  if (error || !saved) {
    // Don't leave an orphaned upload behind.
    if (upload) await (createServiceClient() as any).storage.from(FORMS_BUCKET).remove([upload.path]);
    fail(back, error?.message ?? 'The form could not be saved.');
  }

  // The replaced or removed file is no longer referenced.
  if (existing?.file_path && (upload || removeFile)) {
    await (createServiceClient() as any).storage.from(FORMS_BUCKET).remove([existing.file_path]);
  }

  revalidatePath('/forms');
  revalidatePath('/portal/documents');
  redirect(`/forms?saved=${encodeURIComponent(id ? 'Form updated.' : 'Form created.')}`);
}

export async function archiveFormTemplate(formData: FormData) {
  await requireStaff();
  const id = str(formData, 'id');
  if (!UUID.test(id)) fail('/forms', 'Invalid form.');
  const db = (await createClient()) as any;
  const { data, error } = await db.from('form_templates')
    .update({ archived_at: new Date().toISOString(), active: false, updated_at: new Date().toISOString() })
    .eq('id', id).is('archived_at', null).select('id').maybeSingle();
  if (error || !data) fail(`/forms/${id}`, error?.message ?? 'That form is unavailable or outside your access.');
  revalidatePath('/forms');
  revalidatePath('/portal/documents');
  redirect(`/forms?saved=${encodeURIComponent('Form archived.')}`);
}
