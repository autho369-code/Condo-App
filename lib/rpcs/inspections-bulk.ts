'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { todayInZone } from '@/lib/time/zoned';
import { isValidTimeZone } from '@/lib/time/display-zone';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Keeps each request's id list well under URL length limits.
const BATCH = 100;
const DEFAULT_ZONE = 'America/Chicago';

/** Bulk "Mark done": completes the selected open inspections (RLS-scoped). */
export async function markInspectionsDone(formData: FormData) {
  await requireStaff();
  const back = String(formData.get('return_to') ?? '/inspections');
  const backTo = back.startsWith('/inspections') ? back : '/inspections';
  const sep = backTo.includes('?') ? '&' : '?';
  const fail = (message: string): never => redirect(`${backTo}${sep}error=${encodeURIComponent(message)}`);
  const ids = [...new Set((formData.getAll('inspection_id') as string[]).filter((id) => UUID_RE.test(id)))];
  if (ids.length === 0) fail('Select at least one inspection.');

  const supabase = await createClient();
  const db = supabase as any;

  // Each inspection is completed on today's date in its own association's
  // time zone, so group the selection by that date.
  const idsByDate = new Map<string, string[]>();
  let done = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const { data: rows, error } = await db.from('inspections')
      .select('id, associations(timezone)')
      .in('id', ids.slice(i, i + BATCH))
      .is('archived_at', null)
      .in('status', ['scheduled', 'in_progress']);
    if (error) fail(error.message);
    for (const row of (rows ?? []) as any[]) {
      const tz = row.associations?.timezone;
      const day = todayInZone(tz && isValidTimeZone(tz) ? tz : DEFAULT_ZONE);
      const list = idsByDate.get(day) ?? [];
      list.push(row.id);
      idsByDate.set(day, list);
    }
  }

  for (const [day, dayIds] of idsByDate) {
    for (let i = 0; i < dayIds.length; i += BATCH) {
      const { data: updated, error } = await db.from('inspections')
        .update({ status: 'completed', completed_date: day })
        .in('id', dayIds.slice(i, i + BATCH))
        .is('archived_at', null)
        .in('status', ['scheduled', 'in_progress'])
        .select('id');
      if (error) {
        revalidatePath('/inspections');
        fail(`${done} marked done before an error: ${error.message}`);
      }
      done += (updated ?? []).length;
    }
  }

  const skipped = ids.length - done;
  revalidatePath('/inspections');
  redirect(`${backTo}${sep}marked=${done}${skipped ? `&skipped=${skipped}` : ''}`);
}
