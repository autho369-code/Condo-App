'use server';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { claimSubmission, completeSubmission, releaseSubmission } from '@/lib/forms/submission';

// Homeowner payables go through RPCs that re-check finance permission and
// association scope, enforce the status order and post to the ledger:
// approval accrues (Dr chosen account, Cr A/P), payment clears it (Dr A/P,
// Cr cash), voids post reversing entries.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const uuidOrNull = (v: string) => (UUID.test(v) ? v : null);

export async function createOwnerPayable(formData: FormData) {
  await requireFinanceStaff();
  const failTo = (msg: string): never => redirect(`/bills/owner-payable/new?error=${encodeURIComponent(msg)}`);
  const amount = Number(s(formData, 'amount').replace(/[$,\s]/g, ''));
  const ownerId = uuidOrNull(s(formData, 'owner_id'));
  const associationId = uuidOrNull(s(formData, 'association_id'));
  if (!ownerId || !associationId || !Number.isFinite(amount) || amount <= 0) {
    failTo('Homeowner, association, and a positive amount are required.');
  }
  const payableDate = s(formData, 'payable_date');
  const dueDate = s(formData, 'due_date');

  const db = (await createClient()) as any;
  // A double click or re-sent form must not create the same payable twice.
  const claim = await claimSubmission(db, formData, 'owner_payable');
  if (claim.status === 'error') failTo(claim.message);
  if (claim.status === 'duplicate') {
    if (claim.resultId) redirect(`/bills/owner-payable/${claim.resultId}?saved=1`);
    failTo('This payable is already being saved. Refresh the list in a moment to see it.');
  }
  const token = (claim as { token: string }).token;
  const { data, error } = await db.rpc('create_owner_payable', {
    p_association_id: associationId,
    p_owner_id: ownerId,
    p_gl_account_id: uuidOrNull(s(formData, 'gl_account_id')),
    p_bank_account_id: uuidOrNull(s(formData, 'bank_account_id')),
    p_payable_type: s(formData, 'payable_type') || 'refund',
    p_payable_date: DAY.test(payableDate) ? payableDate : null,
    p_due_date: DAY.test(dueDate) ? dueDate : null,
    p_amount: amount,
    p_memo: s(formData, 'memo'),
  });
  if (error) {
    await releaseSubmission(db, token);
    failTo(error.message);
  }
  if (typeof data === 'string' && data) await completeSubmission(db, token, data);
  revalidatePath('/bills/owner-payable');
  redirect(`/bills/owner-payable/${data}?saved=1`);
}

/** Approve, pay, void the payment, or void a homeowner payable. */
export async function ownerPayableAction(formData: FormData) {
  await requireFinanceStaff();
  const id = uuidOrNull(s(formData, 'id'));
  if (!id) redirect('/bills/owner-payable?error=' + encodeURIComponent('Homeowner payable not found'));
  const back = `/bills/owner-payable/${id}`;
  const op = s(formData, 'op');
  const db = (await createClient()) as any;

  let result: { error: { message: string } | null };
  switch (op) {
    case 'approve':
      result = await db.rpc('approve_owner_payable', { p_id: id });
      break;
    case 'pay': {
      const paidOn = s(formData, 'payment_date');
      result = await db.rpc('pay_owner_payable', {
        p_id: id,
        p_bank_account_id: uuidOrNull(s(formData, 'bank_account_id')),
        p_payment_date: DAY.test(paidOn) ? paidOn : null,
        p_method: s(formData, 'method'),
        p_reference: s(formData, 'reference'),
      });
      break;
    }
    case 'void_payment':
      result = await db.rpc('void_owner_payable_payment', { p_id: id, p_reason: s(formData, 'reason') });
      break;
    case 'void':
      result = await db.rpc('void_owner_payable', { p_id: id });
      break;
    default:
      redirect(`${back}?error=${encodeURIComponent('Choose an action')}`);
  }
  if (result.error) redirect(`${back}?error=${encodeURIComponent(result.error.message)}`);
  revalidatePath('/bills/owner-payable');
  revalidatePath(back);
  redirect(`${back}?done=${op}`);
}
