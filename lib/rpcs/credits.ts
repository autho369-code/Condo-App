'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();

// post_homeowner_credit re-checks finance permission, the unit's company and
// that the credit account and optional charge belong to that unit.
export async function postHomeownerCredit(formData: FormData) {
  await requireFinanceStaff();
  const unitId = s(formData, 'unit_id');
  if (!UUID_RE.test(unitId)) redirect('/units?error=' + encodeURIComponent('Unit not found'));
  const back = `/units/${unitId}`;
  const amount = Number(s(formData, 'amount').replace(/[$,\s]/g, ''));
  const chargeId = s(formData, 'charge_id');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('post_homeowner_credit', {
    p_unit_id: unitId,
    p_amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null,
    p_credit_date: /^\d{4}-\d{2}-\d{2}$/.test(s(formData, 'credit_date')) ? s(formData, 'credit_date') : null,
    p_gl_account_id: UUID_RE.test(s(formData, 'gl_account_id')) ? s(formData, 'gl_account_id') : null,
    p_memo: s(formData, 'memo'),
    p_charge_id: UUID_RE.test(chargeId) ? chargeId : null,
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}#credits`);
  revalidatePath(back);
  redirect(`${back}?credited=1#credits`);
}
