'use server';

// Form templates (Communication → Forms). Staff create, edit and archive
// forms; a form can carry an uploaded file (private storage, signed links)
// or an https link. The file goes browser→storage through a signed upload
// URL (Vercel caps server-action bodies at ~4.5 MB); saveFormTemplate then
// checks the uploaded object before linking it. Every action re-checks staff access in its own body and
// reads the form through the caller's RLS-scoped client before changing it,
// so a form id from the request can only reach the caller's own portfolio.

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { FORMS_BUCKET } from '@/lib/forms/files';
import { FORM_FILE_MAX_BYTES, FORM_FILE_TYPES, isFormFilePath } from '@/lib/forms/file-types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUDIENCES = new Set(['homeowner', 'vendor', 'internal']);
const MAX_MB = Math.round(FORM_FILE_MAX_BYTES / 1048576);

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

/** Authorizes one browser→storage upload into the caller's portfolio folder. */
export async function createFormFileUpload(input: {
  formId?: string | null;
  fileType: string;
  fileSize: number;
}): Promise<{ error?: string; path?: string; token?: string }> {
  const me = await requireStaff();
  let portfolioId = me.portfolio?.id ?? null;
  if (input.formId) {
    if (!UUID.test(input.formId)) return { error: 'Invalid form.' };
    const db = (await createClient()) as any;
    const { data } = await db.from('form_templates').select('portfolio_id').eq('id', input.formId).is('archived_at', null).maybeSingle();
    if (!data) return { error: 'That form is unavailable or outside your access.' };
    portfolioId = data.portfolio_id;
  }
  if (!portfolioId) return { error: 'Your account is not linked to a management company.' };
  const ext = FORM_FILE_TYPES[input.fileType];
  if (!ext) return { error: 'Upload a PDF, Word document, PNG or JPEG.' };
  if (!(input.fileSize > 0)) return { error: 'The file is empty.' };
  if (input.fileSize > FORM_FILE_MAX_BYTES) return { error: `Files can be up to ${MAX_MB} MB.` };

  const path = `forms/${portfolioId}/${randomUUID()}.${ext}`;
  const { data, error } = await (createServiceClient() as any).storage.from(FORMS_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) return { error: error?.message ?? 'Could not authorize the upload.' };
  return { path, token: data.token };
}

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

  // Optional new file, already uploaded by the browser (FormFileInput).
  if (str(formData, 'file_state') === 'uploading') fail(back, 'Wait for the file to finish uploading, then save again.');
  let upload: { path: string; name: string } | null = null;
  const uploadedPath = str(formData, 'file_path');
  if (uploadedPath) {
    const svc = createServiceClient() as any;
    if (!isFormFilePath(uploadedPath, targetPortfolio)) fail(back, 'Invalid file reference. Choose the file again.');
    const { data: info, error: infoErr } = await svc.storage.from(FORMS_BUCKET).info(uploadedPath);
    if (infoErr || !info) fail(back, 'The uploaded file was not found. Choose the file again.');
    const size = Number(info.size ?? info.metadata?.size ?? 0);
    const type = String(info.contentType ?? info.metadata?.mimetype ?? '');
    if (!FORM_FILE_TYPES[type] || !(size > 0) || size > FORM_FILE_MAX_BYTES) {
      await svc.storage.from(FORMS_BUCKET).remove([uploadedPath]);
      fail(back, `Upload a PDF, Word document, PNG or JPEG up to ${MAX_MB} MB.`);
    }
    // A path already linked to a form is never re-linked (or later deleted) through another one.
    const { data: taken } = await svc.from('form_templates').select('id').eq('file_path', uploadedPath).limit(1);
    if (taken?.length) fail(back, 'Invalid file reference. Choose the file again.');
    const ext = FORM_FILE_TYPES[type];
    upload = { path: uploadedPath, name: (str(formData, 'file_name') || `form.${ext}`).slice(0, 200) };
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
