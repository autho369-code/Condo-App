'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

// rate_work_order() decides whether the caller may rate (staff of the
// portfolio, the association's board, or a current owner of the unit), and
// that the job is completed with a vendor.

const BACK_RE = /^\/(work-orders|portal\/work-orders|board\/work-orders)\/[0-9a-f-]{36}$/i;
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();
const stars = (fd: FormData, k: string) => {
  const n = Number(s(fd, k));
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

export async function rateWorkOrder(formData: FormData) {
  await requireAuth();
  const back = BACK_RE.test(s(formData, 'back')) ? s(formData, 'back') : '/';
  const go = (key: 'rating_error' | 'rating_saved', msg: string): never => {
    revalidatePath(back);
    redirect(`${back}?${key}=${encodeURIComponent(msg)}#rating`);
  };
  const score = stars(formData, 'score');
  if (!score) go('rating_error', 'Choose 1 to 5 stars.');
  const hire = s(formData, 'would_hire_again');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('rate_work_order', {
    p_work_order_id: s(formData, 'work_order_id'),
    p_score: score,
    p_quality: stars(formData, 'quality'),
    p_timeliness: stars(formData, 'timeliness'),
    p_communication: stars(formData, 'communication'),
    p_would_hire_again: hire === 'yes' ? true : hire === 'no' ? false : null,
    p_comment: s(formData, 'comment').slice(0, 2000) || null,
  });
  if (error) go('rating_error', error.message);
  go('rating_saved', 'Thanks — your rating was saved.');
}
