'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { claimSubmission, completeSubmission, releaseSubmission } from '@/lib/forms/submission';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const FREQUENCIES = ['monthly', 'quarterly', 'semi_annual', 'annual'];
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();
const money = (fd: FormData, k: string): number | null => {
  const raw = s(fd, k).replace(/[$,%\s]/g, '');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};
// Rates keep up to 3 decimals (e.g. 6.125%); only money rounds to cents.
const rateValue = (fd: FormData, k: string): number | null => {
  const raw = s(fd, k).replace(/[%,\s]/g, '');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : NaN;
};
function go(path: string, key: 'error' | 'saved', msg: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(msg)}`);
}

/**
 * Loan setup: GL accounts, default bank account, terms. The association_loans
 * trigger re-checks that every account belongs to the loan's association and
 * refuses a hand-edited balance once payments are on the ledger; RLS limits the
 * row to staff with access to the association.
 */
export async function saveLoanSetup(formData: FormData) {
  await requireFinanceStaff();
  const id = s(formData, 'loan_id');
  if (!UUID_RE.test(id)) go('/accounting/loans', 'error', 'Loan not found.');
  const back = `/accounting/loans/${id}`;
  const frequency = s(formData, 'payment_frequency');
  const rate = rateValue(formData, 'interest_rate');
  const payment = money(formData, 'payment_amount');
  const nextDate = s(formData, 'next_payment_date');
  const maturity = s(formData, 'maturity_date');
  if (!FREQUENCIES.includes(frequency)) go(back, 'error', 'Choose a payment frequency.');
  if (Number.isNaN(rate) || (rate !== null && (rate < 0 || rate > 50))) go(back, 'error', 'Interest rate must be between 0 and 50%.');
  if (Number.isNaN(payment) || (payment !== null && payment <= 0)) go(back, 'error', 'Payment amount must be greater than zero.');
  const ids = ['gl_account_id', 'interest_gl_account_id', 'bank_account_id'].map((k) => s(formData, k));
  if (ids.some((v) => v && !UUID_RE.test(v))) go(back, 'error', 'Choose valid accounts.');

  const patch: Record<string, unknown> = {
    lender: s(formData, 'lender') || undefined,
    payment_frequency: frequency,
    interest_rate: rate,
    payment_amount: payment,
    next_payment_date: ISO_RE.test(nextDate) ? nextDate : null,
    maturity_date: ISO_RE.test(maturity) ? maturity : null,
    gl_account_id: ids[0] || null,
    interest_gl_account_id: ids[1] || null,
    bank_account_id: ids[2] || null,
    updated_at: new Date().toISOString(),
  };
  // Balance is editable only until the first payment is recorded (the trigger enforces it).
  const balance = money(formData, 'current_balance');
  if (balance !== null) {
    if (Number.isNaN(balance) || balance < 0) go(back, 'error', 'Balance must be zero or more.');
    patch.current_balance = balance;
  }
  if (!patch.lender) delete patch.lender;

  const db = (await createClient()) as any;
  const { data, error } = await db.from('association_loans').update(patch).eq('id', id).is('archived_at', null).select('id');
  if (error) go(back, 'error', error.message);
  if (!data?.length) go(back, 'error', 'Loan not found or outside your access.');
  revalidatePath(back);
  revalidatePath('/accounting/loans');
  go(back, 'saved', 'Loan setup saved.');
}

// record_loan_payment re-checks finance access + association scope, the GL
// setup, the bank account and the balance, then posts one balanced entry.
export async function recordLoanPayment(formData: FormData) {
  await requireFinanceStaff();
  const id = s(formData, 'loan_id');
  if (!UUID_RE.test(id)) go('/accounting/loans', 'error', 'Loan not found.');
  const back = `/accounting/loans/${id}`;
  const amount = money(formData, 'amount');
  const interest = money(formData, 'interest');
  const date = s(formData, 'payment_date');
  const bank = s(formData, 'bank_account_id');
  if (amount === null || Number.isNaN(amount) || amount <= 0) go(back, 'error', 'Enter the payment amount.');
  if (Number.isNaN(interest)) go(back, 'error', 'Enter a valid interest amount, or leave it blank to calculate it.');
  if (!ISO_RE.test(date)) go(back, 'error', 'Enter the payment date.');

  const db = (await createClient()) as any;
  // A double click or re-sent form must not record (and post) the payment twice.
  const claim = await claimSubmission(db, formData, 'loan_payment');
  if (claim.status === 'error') go(back, 'error', claim.message);
  if (claim.status === 'duplicate') {
    if (claim.resultId) go(back, 'saved', 'Payment recorded and posted to the general ledger.');
    go(back, 'error', 'This payment is already being recorded. Refresh in a moment to see it.');
  }
  const token = (claim as { token: string }).token;
  const { data: paymentId, error } = await db.rpc('record_loan_payment', {
    p_loan_id: id,
    p_payment_date: date,
    p_amount: amount,
    p_interest: interest,
    p_bank_account_id: UUID_RE.test(bank) ? bank : null,
    p_reference: s(formData, 'reference') || null,
    p_memo: s(formData, 'memo') || null,
  });
  if (error) {
    await releaseSubmission(db, token);
    go(back, 'error', error.message);
  }
  if (typeof paymentId === 'string' && UUID_RE.test(paymentId)) await completeSubmission(db, token, paymentId);
  revalidatePath(back);
  revalidatePath('/accounting/loans');
  go(back, 'saved', 'Payment recorded and posted to the general ledger.');
}

export async function voidLoanPayment(formData: FormData) {
  await requireFinanceStaff();
  const loanId = s(formData, 'loan_id');
  const back = UUID_RE.test(loanId) ? `/accounting/loans/${loanId}` : '/accounting/loans';
  const paymentId = s(formData, 'payment_id');
  if (!UUID_RE.test(paymentId)) go(back, 'error', 'Payment not found.');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('void_loan_payment', { p_payment_id: paymentId, p_reason: s(formData, 'reason') });
  if (error) go(back, 'error', error.message);
  revalidatePath(back);
  revalidatePath('/accounting/loans');
  go(back, 'saved', 'Payment voided — a reversing entry was posted today and the balance restored.');
}
