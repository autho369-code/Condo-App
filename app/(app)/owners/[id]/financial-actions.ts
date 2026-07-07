'use server';

// Owner financial details (federal tax / payout bank / accounting prefs)
// and ad-hoc attachments for the owner detail page.
//
// owner_financial_details is RLS-gated to finance staff — a non-finance
// session's upsert fails loudly and redirects back with ?error=.
// Sensitive fields (TIN, bank numbers) are write-only from the form: a
// blank input means "keep the stored value", so the real value never
// round-trips to the browser.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';

const BUCKET = 'association-documents';

function fail(ownerId: string, message: string): never {
  redirect(`/owners/${ownerId}?error=${encodeURIComponent(message)}`);
}

function str(fd: FormData, key: string): string | null {
  const v = (fd.get(key) as string | null)?.trim();
  return v ? v : null;
}

export async function saveOwnerFinancialDetails(ownerId: string, portfolioId: string, formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();

  const patch: Record<string, unknown> = {
    owner_id: ownerId,
    portfolio_id: portfolioId,
    taxpayer_name: str(formData, 'taxpayer_name'),
    tax_form_account_number: str(formData, 'tax_form_account_number'),
    send_1099: formData.get('send_1099') === 'on',
    electronic_1099_consent: formData.get('electronic_1099_consent') === 'on',
    sending_preference_1099: str(formData, 'sending_preference_1099') ?? 'paper',
    paid_by_ach: formData.get('paid_by_ach') === 'on',
    check_consolidation: str(formData, 'check_consolidation') ?? 'single_check',
    check_stub_show_detail: formData.get('check_stub_show_detail') === 'on',
    hold_payments: formData.get('hold_payments') === 'on',
    email_echeck_receipt: formData.get('email_echeck_receipt') === 'on',
    default_check_memo: str(formData, 'default_check_memo'),
    updated_at: new Date().toISOString(),
    updated_by: me.auth_user_id,
  };
  // Write-only sensitive fields: only overwrite when a new value is typed.
  const tin = str(formData, 'taxpayer_id');
  if (tin) patch.taxpayer_id = tin;
  const routing = str(formData, 'bank_routing_number');
  if (routing) patch.bank_routing_number = routing;
  const account = str(formData, 'bank_account_number');
  if (account) patch.bank_account_number = account;

  const { error } = await (supabase as any)
    .from('owner_financial_details')
    .upsert(patch, { onConflict: 'owner_id' });
  if (error) fail(ownerId, `Could not save financial details: ${error.message}`);
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}?saved=financial`);
}

export async function addOwnerAttachment(ownerId: string, portfolioId: string, formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) fail(ownerId, 'Choose a file to attach.');
  if (file.size > 25 * 1024 * 1024) fail(ownerId, 'Attachments are limited to 25 MB.');

  const svc = createServiceClient() as any;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `owners/${ownerId}/${Date.now()}-${safeName}`;
  const { error: upErr } = await svc.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (upErr) fail(ownerId, `Upload failed: ${upErr.message}`);

  const { error } = await (supabase as any).from('owner_attachments').insert({
    owner_id: ownerId,
    portfolio_id: portfolioId,
    file_name: file.name,
    file_path: path,
    content_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: me.auth_user_id,
  });
  if (error) {
    await svc.storage.from(BUCKET).remove([path]);
    fail(ownerId, `Could not save attachment: ${error.message}`);
  }
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}?saved=attachment`);
}

export async function removeOwnerAttachment(ownerId: string, attachmentId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data: row, error: readErr } = await (supabase as any)
    .from('owner_attachments')
    .select('id, file_path')
    .eq('id', attachmentId)
    .maybeSingle();
  if (readErr || !row) fail(ownerId, 'Attachment not found.');

  const { error } = await (supabase as any).from('owner_attachments').delete().eq('id', attachmentId);
  if (error) fail(ownerId, `Could not remove attachment: ${error.message}`);

  const svc = createServiceClient() as any;
  await svc.storage.from(BUCKET).remove([row.file_path]);
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}`);
}
