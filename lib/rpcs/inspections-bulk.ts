'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { todayInZone } from '@/lib/time/zoned';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Bulk "Mark done": completes the selected open inspections (RLS-scoped). */
export async function markInspectionsDone(formData: FormData) {
  await requireStaff();
  const back = String(formData.get('return_to') ?? '/inspections');
  const backTo = back.startsWith('/inspections') ? back : '/inspections';
  const sep = backTo.includes('?') ? '&' : '?';
  const ids = [...new Set((formData.getAll('inspection_id') as string[]).filter((id) => UUID_RE.test(id)))];
  if (ids.length === 0) redirect(`${backTo}${sep}error=${encodeURIComponent('Select at least one inspection.')}`);

  const supabase = await createClient();
  const { data: updated, error } = await (supabase as any).from('inspections')
    .update({ status: 'completed', completed_date: todayInZone() })
    .in('id', ids)
    .is('archived_at', null)
    .in('status', ['scheduled', 'in_progress'])
    .select('id');
  if (error) redirect(`${backTo}${sep}error=${encodeURIComponent(error.message)}`);

  const done = (updated ?? []).length;
  const skipped = ids.length - done;
  revalidatePath('/inspections');
  redirect(`${backTo}${sep}marked=${done}${skipped ? `&skipped=${skipped}` : ''}`);
}
