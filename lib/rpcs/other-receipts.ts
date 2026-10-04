'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { claimSubmission, completeSubmission, releaseSubmission } from '@/lib/forms/submission';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();
const MAX_LINES = 20;

// record_other_receipt re-checks finance access, association scope, that the
// bank account belongs to the association and that every GL line is in the
// same company, then posts the balanced journal entry in one transaction.
export async function recordOtherReceipt(formData: FormData) {
  await requireFinanceStaff();
  const fail = (m: string): never => redirect('/receipts/other/new?error=' + encodeURIComponent(m));

  const lines: Array<{ gl_account_id: string; amount: number; memo: string }> = [];
  for (let i = 0; i < MAX_LINES; i++) {
    const gl = s(formData, `line_gl_${i}`);
    const rawAmount = s(formData, `line_amount_${i}`).replace(/[$,\s]/g, '');
    const memo = s(formData, `line_memo_${i}`);
    if (!gl && !rawAmount && !memo) continue;
    const amount = Number(rawAmount);
    if (!UUID_RE.test(gl)) fail(`Line ${lines.length + 1}: choose a GL account.`);
    if (!Number.isFinite(amount) || amount <= 0) fail(`Line ${lines.length + 1}: enter an amount greater than zero.`);
    lines.push({ gl_account_id: gl, amount: Math.round(amount * 100) / 100, memo });
  }
  if (lines.length === 0) fail('Add at least one line with a GL account and amount.');

  const payerType = s(formData, 'payer_type') === 'vendor' ? 'vendor' : 'other';
  const vendorId = s(formData, 'vendor_id');
  const receiptDate = s(formData, 'receipt_date');
  const db = (await createClient()) as any;

  // A double click or re-sent form must not record the receipt twice.
  const claim = await claimSubmission(db, formData, 'other_receipt');
  if (claim.status === 'error') fail(claim.message);
  if (claim.status === 'duplicate') {
    if (claim.resultId) redirect(`/receipts/other/${claim.resultId}?recorded=1`);
    fail('This receipt is already being recorded. Refresh the other receipts list in a moment to see it.');
  }
  const token = (claim as { token: string }).token;

  const { data, error } = await db.rpc('record_other_receipt', {
    p_association_id: UUID_RE.test(s(formData, 'association_id')) ? s(formData, 'association_id') : null,
    p_bank_account_id: UUID_RE.test(s(formData, 'bank_account_id')) ? s(formData, 'bank_account_id') : null,
    p_receipt_date: /^\d{4}-\d{2}-\d{2}$/.test(receiptDate) ? receiptDate : null,
    p_payer_type: payerType,
    p_vendor_id: payerType === 'vendor' && UUID_RE.test(vendorId) ? vendorId : null,
    p_payer_name: s(formData, 'payer_name'),
    p_reference: s(formData, 'reference'),
    p_memo: s(formData, 'memo'),
    p_lines: lines,
  });
  if (error || !data) {
    await releaseSubmission(db, token);
    fail(error?.message ?? 'Could not record the receipt.');
  }
  if (typeof data === 'string' && UUID_RE.test(data)) await completeSubmission(db, token, data);
  revalidatePath('/receipts/other');
  redirect(`/receipts/other/${data}?recorded=1`);
}

// void_other_receipt re-checks access and posts a reversing entry dated today.
export async function voidOtherReceipt(formData: FormData) {
  await requireFinanceStaff();
  const id = s(formData, 'receipt_id');
  if (!UUID_RE.test(id)) redirect('/receipts/other?error=' + encodeURIComponent('Receipt not found'));
  const db = (await createClient()) as any;
  const { error } = await db.rpc('void_other_receipt', { p_receipt_id: id, p_reason: s(formData, 'reason') });
  if (error) redirect(`/receipts/other/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/receipts/other');
  revalidatePath(`/receipts/other/${id}`);
  redirect(`/receipts/other/${id}?voided=1`);
}
