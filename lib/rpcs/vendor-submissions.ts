'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { requireVendor } from '@/lib/auth/me';
import { isScopedStoragePath } from '@/lib/security/storage-paths';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const BUCKET = 'association-documents';
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'heic', 'doc', 'docx']);
const COMPLIANCE_TYPES = new Set([
  'workers_comp',
  'general_liability',
  'auto_insurance',
  'epa_certification',
  'state_license',
  'contract',
  'w9',
  'other',
]);

function safeFileName(fileName: string) {
  return fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180);
}

function validDate(value: string | null | undefined) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function removeUploadedFile(path: string) {
  try {
    await (createServiceClient() as any).storage.from(BUCKET).remove([path]);
  } catch (error) {
    console.error('Could not clean up rejected vendor upload', error);
  }
}

export async function createVendorUpload(
  fileName: string,
  fileSize: number,
  category: 'compliance' | 'invoice',
): Promise<{ error?: string; path?: string; token?: string }> {
  const me = await requireVendor();
  if (!me.auth_user_id || !me.vendor_id) return { error: 'Not signed in as a vendor.' };
  if (category !== 'compliance' && category !== 'invoice') return { error: 'Invalid upload category.' };

  const normalizedName = safeFileName(fileName);
  const extension = normalizedName.split('.').pop()?.toLowerCase() ?? '';
  if (!normalizedName || !ALLOWED_EXTENSIONS.has(extension)) {
    return { error: 'Upload a PDF, image, Word document, or HEIC file.' };
  }
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) return { error: 'The selected file is empty.' };
  if (fileSize > MAX_FILE_BYTES) return { error: 'Documents must be 25 MB or smaller.' };

  const path = `vendors/${me.vendor_id}/${category}/${randomUUID()}-${normalizedName}`;
  const service = createServiceClient() as any;
  const { data, error } = await service.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) return { error: error?.message ?? 'Could not authorize the upload.' };
  return { path, token: data.token };
}

export async function saveVendorComplianceDocument(input: {
  path: string;
  fileName: string;
  documentType: string;
  expiresAt?: string | null;
  requestId?: string | null;
}): Promise<{ error?: string; ok?: boolean }> {
  const me = await requireVendor();
  if (!me.auth_user_id || !me.vendor_id) return { error: 'Not signed in as a vendor.' };

  const documentType = input.documentType.trim().toLowerCase();
  const fileName = safeFileName(input.fileName);
  const expiresAt = input.expiresAt || null;
  if (!isScopedStoragePath(input.path, 'vendors', me.vendor_id) || !input.path.includes('/compliance/')) {
    return { error: 'Invalid document reference.' };
  }
  const reject = async (message: string) => {
    await removeUploadedFile(input.path);
    return { error: message };
  };
  if (!COMPLIANCE_TYPES.has(documentType)) return reject('Select a valid document type.');
  if (!fileName) return reject('The document name is required.');
  if (!validDate(expiresAt)) return reject('Enter a valid expiration date.');

  const service = createServiceClient() as any;
  const { data: objectInfo, error: objectError } = await service.storage.from(BUCKET).info(input.path);
  if (objectError || !objectInfo) return { error: 'The uploaded document could not be verified.' };

  let request: any = null;
  if (input.requestId) {
    const { data, error } = await service
      .from('document_requests')
      .select('id, attachment_urls')
      .eq('id', input.requestId)
      .eq('vendor_id', me.vendor_id)
      .maybeSingle();
    if (error || !data) {
      await removeUploadedFile(input.path);
      return { error: 'The selected document request is not available to this vendor.' };
    }
    request = data;
  }

  const { data: document, error: documentError } = await service.from('documents').insert({
    entity_type: 'vendor',
    entity_id: me.vendor_id,
    doc_type: documentType,
    file_name: fileName,
    file_url: input.path,
    expires_at: expiresAt ? new Date(`${expiresAt}T00:00:00.000Z`).toISOString() : null,
    uploaded_by: me.auth_user_id,
  }).select('id').single();
  if (documentError) {
    await removeUploadedFile(input.path);
    return { error: documentError.message };
  }

  if (request) {
    const prior = Array.isArray(request.attachment_urls) ? request.attachment_urls : [];
    const { error: requestError } = await service.from('document_requests').update({
      attachment_urls: [...prior, input.path],
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }).eq('id', request.id).eq('vendor_id', me.vendor_id);
    if (requestError) {
      await service.from('documents').delete().eq('id', document.id);
      await removeUploadedFile(input.path);
      return { error: `The document request could not be updated: ${requestError.message}` };
    }
  }

  revalidatePath('/vendor/compliance');
  revalidatePath('/vendors/compliance');
  return { ok: true };
}

export async function submitVendorInvoice(input: {
  workOrderId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  amount: string;
  memo?: string | null;
  attachment: { path: string; name: string };
}): Promise<{ error?: string; invoiceId?: string }> {
  const me = await requireVendor();
  if (!me.auth_user_id || !me.vendor_id) return { error: 'Not signed in as a vendor.' };

  const invoiceNumber = input.invoiceNumber.trim();
  const amount = input.amount.trim().replace(/[$,\s]/g, '');
  const memo = input.memo?.trim() || null;
  if (!isScopedStoragePath(input.attachment.path, 'vendors', me.vendor_id) || !input.attachment.path.includes('/invoice/')) {
    return { error: 'Invalid invoice attachment reference.' };
  }
  const reject = async (message: string) => {
    await removeUploadedFile(input.attachment.path);
    return { error: message };
  };
  if (!input.workOrderId) return reject('Select the related work order.');
  if (invoiceNumber.length < 1 || invoiceNumber.length > 100) return reject('Invoice number must be 1 to 100 characters.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || amount === '0' || amount === '0.0' || amount === '0.00') {
    return reject('Enter a positive amount with no more than two decimal places.');
  }
  if (!validDate(input.invoiceDate) || !input.invoiceDate) return reject('Enter a valid invoice date.');
  if (!validDate(input.dueDate)) return reject('Enter a valid due date.');
  if (input.dueDate && input.dueDate < input.invoiceDate) return reject('Due date cannot be before the invoice date.');
  if (memo && memo.length > 1000) return reject('Memo must be 1,000 characters or fewer.');

  const service = createServiceClient() as any;
  const { data: objectInfo, error: objectError } = await service.storage.from(BUCKET).info(input.attachment.path);
  if (objectError || !objectInfo) return { error: 'The uploaded invoice could not be verified.' };

  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('submit_vendor_invoice', {
    p_work_order_id: input.workOrderId,
    p_bill_number: invoiceNumber,
    p_bill_date: input.invoiceDate,
    p_due_date: input.dueDate || null,
    p_amount: amount,
    p_memo: memo,
    p_attachment_path: input.attachment.path,
    p_file_name: safeFileName(input.attachment.name),
  });
  if (error) {
    await removeUploadedFile(input.attachment.path);
    return { error: error.message };
  }

  revalidatePath('/vendor/payments');
  revalidatePath('/bills');
  return { invoiceId: data as string };
}
