'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceOrPortfolioAdmin, requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();
const on = (fd: FormData, k: string) => fd.get(k) === 'on';

const target = (fd: FormData) => {
  const ownerId = s(fd, 'owner_id');
  return `/owners/${UUID_RE.test(ownerId) ? ownerId : ''}`;
};

// The RPCs re-check finance/staff permission and association scope in the database.
export async function setCollectionStatus(formData: FormData) {
  await requireFinanceOrPortfolioAdmin();
  const to = target(formData);
  const db = (await createClient()) as any;
  const { error } = await db.rpc('set_occupancy_collection_status', {
    p_occupancy_id: s(formData, 'occupancy_id'),
    p_in_foreclosure: on(formData, 'in_foreclosure'),
    p_in_collections: on(formData, 'in_collections'),
    p_certified_funds_only: on(formData, 'certified_funds_only'),
    p_allow_online_payments: on(formData, 'allow_online_payments'),
    p_require_full_online_payment: on(formData, 'require_full_online_payment'),
  });
  if (error) redirect(`${to}?error=${encodeURIComponent(error.message)}#collections`);
  revalidatePath(to);
  redirect(`${to}?saved=collections#collections`);
}

export async function addDelinquencyNote(formData: FormData) {
  await requireStaff();
  const to = target(formData);
  const db = (await createClient()) as any;
  const { error } = await db.rpc('add_occupancy_delinquency_note', {
    p_occupancy_id: s(formData, 'occupancy_id'),
    p_note: s(formData, 'note'),
  });
  if (error) redirect(`${to}?error=${encodeURIComponent(error.message)}#collections`);
  revalidatePath(to);
  redirect(`${to}?saved=delinquency_note#collections`);
}
