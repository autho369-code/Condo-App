'use server';
import { revalidatePath } from 'next/cache';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { parseImportCsv } from '@/lib/imports/csv';
import { claimSubmission, completeSubmission, contentSubmissionToken, releaseSubmission, SUBMISSION_FIELD } from '@/lib/forms/submission';

export type ImportResult = { ok: boolean; message: string; errors?: string[]; errorCount?: number; href?: string };

const MAX_BYTES = 2 * 1024 * 1024;

async function readRows(formData: FormData): Promise<{ rows?: Record<string, string>[]; text?: string; error?: string }> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CSV file to upload.' };
  if (file.size > MAX_BYTES) return { error: 'The file is larger than 2 MB. Split it into smaller files.' };
  const text = await file.text();
  return { ...parseImportCsv(text), text };
}

/**
 * The same file posts once: a double click, a retry after a timeout or a
 * second upload of an identical file would otherwise post every entry again.
 */
async function claimFile(db: any, kind: string, text: string): Promise<{ token?: string; message?: string }> {
  const tokenData = new FormData();
  tokenData.set(SUBMISSION_FIELD, await contentSubmissionToken(kind, text));
  const claim = await claimSubmission(db, tokenData, kind);
  if (claim.status === 'error') return { message: claim.message };
  if (claim.status === 'duplicate') return { message: 'This exact file was already uploaded and posted. Change the file if you meant to post different entries.' };
  return { token: claim.token };
}

export async function importJournalEntries(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  await requireFinanceStaff();
  const { rows, text, error } = await readRows(formData);
  if (error || !rows || text == null) return { ok: false, message: error ?? 'Could not read the file.' };
  const db = (await createClient()) as any;
  const claim = await claimFile(db, 'journal_entry_upload', text);
  if (!claim.token) return { ok: false, message: claim.message ?? 'The file could not be uploaded.' };
  const { data, error: rpcError } = await db.rpc('import_journal_entry_batch', {
    p_name: String(formData.get('name') ?? '').trim() || null,
    p_rows: rows,
  });
  // Nothing posted: release the claim so the corrected file can be uploaded.
  if (rpcError || !data?.ok) await releaseSubmission(db, claim.token);
  else if (data.batch_id) await completeSubmission(db, claim.token, String(data.batch_id));
  if (rpcError) return { ok: false, message: rpcError.message };
  if (!data?.ok) {
    return { ok: false, message: `Nothing was posted — fix ${data?.error_count ?? 'the'} problem${data?.error_count === 1 ? '' : 's'} and upload again.`, errors: data?.errors ?? [], errorCount: data?.error_count };
  }
  revalidatePath('/journal-entries');
  return { ok: true, message: `Posted ${data.entries} journal entr${data.entries === 1 ? 'y' : 'ies'} totalling $${Number(data.total).toFixed(2)}.`, href: '/journal-entries?tab=batches' };
}

export async function importBills(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  await requireFinanceStaff();
  const { rows, text, error } = await readRows(formData);
  if (error || !rows || text == null) return { ok: false, message: error ?? 'Could not read the file.' };
  const db = (await createClient()) as any;
  const claim = await claimFile(db, 'bill_upload', text);
  if (!claim.token) return { ok: false, message: claim.message ?? 'The file could not be uploaded.' };
  const { data, error: rpcError } = await db.rpc('import_bills', { p_rows: rows });
  if (rpcError || !data?.ok) await releaseSubmission(db, claim.token);
  if (rpcError) return { ok: false, message: rpcError.message };
  if (!data?.ok) {
    return { ok: false, message: `No bills were created — fix ${data?.error_count ?? 'the'} problem${data?.error_count === 1 ? '' : 's'} and upload again.`, errors: data?.errors ?? [], errorCount: data?.error_count };
  }
  revalidatePath('/bills');
  return { ok: true, message: `Created ${data.count} draft bill${data.count === 1 ? '' : 's'} totalling $${Number(data.total).toFixed(2)}. Submit or approve them from the bills list.`, href: '/bills?status=all' };
}
