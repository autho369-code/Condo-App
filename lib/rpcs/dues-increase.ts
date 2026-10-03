'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceOrPortfolioAdmin } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

// apply_dues_increase re-checks finance permission for the association and
// that the charge category belongs to its company.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF = /^[a-z0-9-]{1,80}$/i;
const MODES = ['percent', 'amount', 'set'];

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

function realDate(raw: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? raw : null;
}

/** Applies a dues increase to every active recurring charge of one category in an association. */
export async function applyDuesIncrease(formData: FormData) {
  await requireFinanceOrPortfolioAdmin();
  const associationId = s(formData, 'association_id');
  if (!UUID.test(associationId)) redirect('/associations');
  const ref = REF.test(s(formData, 'association_ref')) ? s(formData, 'association_ref') : associationId;
  const categoryId = s(formData, 'charge_category_id');
  const mode = s(formData, 'mode');
  const value = Number(s(formData, 'value'));
  const effective = realDate(s(formData, 'effective_date'));
  const back = `/associations/${ref}/budget/dues-increase?${new URLSearchParams({ category: categoryId, mode, value: s(formData, 'value'), effective: effective ?? '' })}`;
  const fail = (message: string): never => redirect(`${back}&error=${encodeURIComponent(message)}`);

  if (!UUID.test(categoryId)) fail('Choose the charge to increase.');
  if (!MODES.includes(mode)) fail('Choose how to change the dues.');
  if (!Number.isFinite(value)) fail('Enter the increase.');
  if (!effective) fail('Enter a valid effective date.');
  if (formData.get('confirm') !== 'on') fail('Tick the confirmation box to apply the increase.');

  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('apply_dues_increase', {
    p_association_id: associationId,
    p_charge_category_id: categoryId,
    p_mode: mode,
    p_value: value,
    p_effective_date: effective,
    p_apply: true,
  });
  if (error) fail(error.message);
  const rows = Array.isArray(data) ? data : [];
  const changed = rows.filter((r: any) => Number(r.new_amount) !== Number(r.old_amount)).length;
  revalidatePath(`/associations/${ref}/budget/dues-increase`);
  revalidatePath(`/associations/${ref}/units`);
  redirect(`/associations/${ref}/budget/dues-increase?saved=${encodeURIComponent(
    `Dues updated for ${changed} unit${changed === 1 ? '' : 's'}. The new amount bills from each unit's first charge on or after ${effective}; charges already posted are unchanged.`,
  )}`);
}
