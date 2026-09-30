'use server';
import { revalidatePath } from 'next/cache';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { parseImportCsv } from '@/lib/imports/csv';

export type ImportResult = { ok: boolean; message: string; errors?: string[]; errorCount?: number; href?: string };

const MAX_BYTES = 2 * 1024 * 1024;

async function readRows(formData: FormData): Promise<{ rows?: Record<string, string>[]; error?: string }> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CSV file to upload.' };
  if (file.size > MAX_BYTES) return { error: 'The file is larger than 2 MB. Split it into smaller files.' };
  return parseImportCsv(await file.text());
}

export async function importJournalEntries(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  await requireFinanceStaff();
  const { rows, error } = await readRows(formData);
  if (error || !rows) return { ok: false, message: error ?? 'Could not read the file.' };
  const db = (await createClient()) as any;
  const { data, error: rpcError } = await db.rpc('import_journal_entry_batch', {
    p_name: String(formData.get('name') ?? '').trim() || null,
    p_rows: rows,
  });
  if (rpcError) return { ok: false, message: rpcError.message };
  if (!data?.ok) {
    return { ok: false, message: `Nothing was posted — fix ${data?.error_count ?? 'the'} problem${data?.error_count === 1 ? '' : 's'} and upload again.`, errors: data?.errors ?? [], errorCount: data?.error_count };
  }
  revalidatePath('/journal-entries');
  return { ok: true, message: `Posted ${data.entries} journal entr${data.entries === 1 ? 'y' : 'ies'} totalling $${Number(data.total).toFixed(2)}.`, href: '/journal-entries?tab=batches' };
}

export async function importBills(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  await requireFinanceStaff();
  const { rows, error } = await readRows(formData);
  if (error || !rows) return { ok: false, message: error ?? 'Could not read the file.' };
  const db = (await createClient()) as any;
  const { data, error: rpcError } = await db.rpc('import_bills', { p_rows: rows });
  if (rpcError) return { ok: false, message: rpcError.message };
  if (!data?.ok) {
    return { ok: false, message: `No bills were created — fix ${data?.error_count ?? 'the'} problem${data?.error_count === 1 ? '' : 's'} and upload again.`, errors: data?.errors ?? [], errorCount: data?.error_count };
  }
  revalidatePath('/bills');
  return { ok: true, message: `Created ${data.count} draft bill${data.count === 1 ? '' : 's'} totalling $${Number(data.total).toFixed(2)}. Submit or approve them from the bills list.`, href: '/bills?status=all' };
}
