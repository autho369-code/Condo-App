'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();
const uuidOrNull = (v: string) => (UUID_RE.test(v) ? v : null);
const numberOrNull = (v: string) => {
  const n = Number(v.replace(/[$,\s]/g, ''));
  return v !== '' && Number.isFinite(n) ? n : null;
};

// The RPCs re-check finance permission and that every referenced record belongs
// to the caller's company.
export async function saveRecurringBill(formData: FormData) {
  await requireFinanceStaff();
  const id = uuidOrNull(s(formData, 'id'));
  const back = id ? `/bills/recurring/${id}/edit` : '/bills/recurring/new';
  const db = (await createClient()) as any;
  const { error } = await db.rpc('save_recurring_bill', {
    p_id: id,
    p_vendor_id: uuidOrNull(s(formData, 'vendor_id')),
    p_association_id: uuidOrNull(s(formData, 'association_id')),
    p_gl_account_id: uuidOrNull(s(formData, 'gl_account_id')),
    p_bank_account_id: uuidOrNull(s(formData, 'bank_account_id')),
    p_name: s(formData, 'name'),
    p_memo: s(formData, 'memo'),
    p_amount: numberOrNull(s(formData, 'amount')),
    p_frequency: s(formData, 'frequency'),
    p_interval: Math.max(1, Math.trunc(numberOrNull(s(formData, 'interval_count')) ?? 1)),
    p_start_date: s(formData, 'start_date') || null,
    p_end_date: s(formData, 'end_date') || null,
    p_due_days: Math.max(0, Math.trunc(numberOrNull(s(formData, 'due_days')) ?? 0)),
    p_active: formData.get('active') === 'on',
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/bills/recurring');
  redirect('/bills/recurring?saved=1');
}

export async function archiveRecurringBill(formData: FormData) {
  await requireFinanceStaff();
  const id = uuidOrNull(s(formData, 'id'));
  if (!id) redirect('/bills/recurring?error=' + encodeURIComponent('Recurring bill not found'));
  const db = (await createClient()) as any;
  const { error } = await db.rpc('archive_recurring_bill', { p_id: id });
  if (error) redirect(`/bills/recurring?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/bills/recurring');
  redirect('/bills/recurring?archived=1');
}

export async function saveRecurringJournalEntry(formData: FormData) {
  await requireFinanceStaff();
  const back = '/journal-entries/recurring/new';
  const lines: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 12; i++) {
    const gl = uuidOrNull(s(formData, `line_${i}_gl`));
    const debit = numberOrNull(s(formData, `line_${i}_debit`)) ?? 0;
    const credit = numberOrNull(s(formData, `line_${i}_credit`)) ?? 0;
    if (!gl && !debit && !credit) continue;
    if (!gl) redirect(`${back}?error=${encodeURIComponent(`Line ${i + 1} needs a GL account`)}`);
    lines.push({
      gl_account_id: gl,
      association_id: uuidOrNull(s(formData, `line_${i}_association`)),
      debit,
      credit,
      memo: s(formData, `line_${i}_memo`) || null,
    });
  }
  const db = (await createClient()) as any;
  const { error } = await db.rpc('save_recurring_journal_entry', {
    p_id: null,
    p_name: s(formData, 'name'),
    p_memo: s(formData, 'memo'),
    p_frequency: s(formData, 'frequency'),
    p_interval: Math.max(1, Math.trunc(numberOrNull(s(formData, 'interval_count')) ?? 1)),
    p_next_date: s(formData, 'next_date') || null,
    p_lines: lines,
    p_active: true,
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/journal-entries');
  redirect('/journal-entries?tab=recurring&saved=1');
}
