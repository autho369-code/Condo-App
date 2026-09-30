'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { parseImportCsv } from '@/lib/imports/csv';
import type { ImportResult } from '@/lib/rpcs/imports';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();

// Every RPC re-checks finance permission and the batch's association scope.
export async function importLockbox(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  await requireFinanceStaff();
  const bank = s(formData, 'bank_account_id');
  const date = s(formData, 'batch_date');
  if (!UUID_RE.test(bank)) return { ok: false, message: 'Choose the bank account the lockbox deposits into.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: 'Enter the deposit date.' };
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Choose the lockbox CSV file.' };
  if (file.size > 2 * 1024 * 1024) return { ok: false, message: 'The file is larger than 2 MB.' };
  const { rows, error } = parseImportCsv(await file.text());
  if (error || !rows) return { ok: false, message: error ?? 'Could not read the file.' };

  const db = (await createClient()) as any;
  const { data, error: rpcError } = await db.rpc('import_lockbox_batch', {
    p_bank_account_id: bank,
    p_batch_date: date,
    p_reference: s(formData, 'reference') || null,
    p_rows: rows,
  });
  if (rpcError) return { ok: false, message: rpcError.message };
  if (!data?.ok) {
    return { ok: false, message: `Nothing was imported — fix ${data?.error_count ?? 'the'} problem${data?.error_count === 1 ? '' : 's'} and upload again.`, errors: data?.errors ?? [], errorCount: data?.error_count };
  }
  revalidatePath('/bank-accounts/lockbox');
  return {
    ok: true,
    message: `Imported ${data.items} check${data.items === 1 ? '' : 's'} ($${Number(data.total).toFixed(2)}); ${data.matched} matched automatically. Review and post them.`,
    href: `/bank-accounts/lockbox/${data.batch_id}`,
  };
}

function backTo(fd: FormData) {
  const batch = s(fd, 'batch_id');
  return UUID_RE.test(batch) ? `/bank-accounts/lockbox/${batch}` : '/bank-accounts/lockbox';
}

export async function matchLockboxItem(formData: FormData) {
  await requireFinanceStaff();
  const back = backTo(formData);
  const item = s(formData, 'item_id');
  const unit = s(formData, 'unit_id');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('match_lockbox_item', { p_item: UUID_RE.test(item) ? item : null, p_unit_id: UUID_RE.test(unit) ? unit : null });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(back);
  redirect(back);
}

export async function rejectLockboxItem(formData: FormData) {
  await requireFinanceStaff();
  const back = backTo(formData);
  const item = s(formData, 'item_id');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('reject_lockbox_item', { p_item: UUID_RE.test(item) ? item : null, p_reason: s(formData, 'reason') || null });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(back);
  redirect(back);
}

export async function postLockboxBatch(formData: FormData) {
  await requireFinanceStaff();
  const back = backTo(formData);
  const batch = s(formData, 'batch_id');
  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('post_lockbox_batch', { p_batch: UUID_RE.test(batch) ? batch : null });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(back);
  revalidatePath('/bank-accounts/lockbox');
  redirect(`${back}?posted=${data?.posted ?? 0}&failed=${data?.failed ?? 0}`);
}
