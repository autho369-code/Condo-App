'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceOrPortfolioAdmin } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();

// set_owner_late_fee_override() re-checks finance permission and association
// scope for the ownership record, and writes the audit log.
export async function setOwnerLateFeeOverride(formData: FormData) {
  await requireFinanceOrPortfolioAdmin();
  const ownerId = s(formData, 'owner_id');
  const to = `/owners/${UUID_RE.test(ownerId) ? ownerId : ''}`;
  const fail = (msg: string): never => redirect(`${to}?error=${encodeURIComponent(msg)}#late-fees`);

  const mode = s(formData, 'mode');
  const rawAmount = s(formData, 'amount');
  const amount = mode === 'custom' ? Number(rawAmount) : null;
  if (mode === 'custom' && (rawAmount === '' || !Number.isFinite(amount))) fail('Enter the custom late fee.');

  const db = (await createClient()) as any;
  const { error } = await db.rpc('set_owner_late_fee_override', {
    p_occupancy_id: s(formData, 'occupancy_id'),
    p_exempt: mode === 'exempt',
    p_amount: amount,
    p_is_percent: s(formData, 'unit') === 'percent',
    p_until: mode === 'default' ? null : s(formData, 'until') || null,
    p_reason: mode === 'default' ? null : s(formData, 'reason') || null,
  });
  if (error) fail(error.message);
  revalidatePath(to);
  redirect(`${to}?saved=late_fee#late-fees`);
}
