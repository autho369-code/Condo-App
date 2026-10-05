import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { nextRecurringDate } from '@/lib/time/recurrence';
import { todayInZone } from '@/lib/time/zoned';

export const dynamic = 'force-dynamic';

/**
 * "Generate now" — create a real work_order from a recurring template and
 * advance the template's next_due_date / last_generated_at. Mirrors what the
 * nightly cron (generate_recurring_work_orders) does, but for a single template
 * on demand.
 */
export async function POST(req: NextRequest) {
  await requireStaff();
  const form = await req.formData();
  const id = form.get('id') as string | null;

  const origin = new URL(req.url).origin;
  const back = (params = '') => NextResponse.redirect(`${origin}/recurring-work-orders${params}`, { status: 303 });

  if (!id) return back('?error=' + encodeURIComponent('Missing recurring work order id.'));

  const supabase = await createClient();
  const db = supabase as any;

  const { data: tpl, error: tplErr } = await db
    .from('recurring_work_orders')
    .select('*')
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle();
  if (tplErr || !tpl) return back('?error=' + encodeURIComponent('Recurring work order not found.'));

  // Same schedule rule as the nightly generator (anchored on the start day).
  const base = tpl.next_due_date ?? todayInZone();
  const anchorDay = Number(String(tpl.start_date ?? base).slice(8, 10)) || null;
  const next = nextRecurringDate(base, tpl.frequency ?? 'monthly', tpl.interval_count ?? 1, anchorDay);
  if (!next) return back('?error=' + encodeURIComponent('This plan has an unknown frequency.'));

  // Claim the occurrence and create the work order in one transaction: the
  // schedule advances only if next_due_date is still the value we read (so a
  // double-click or a race with the nightly generator yields one work order),
  // and a failure anywhere leaves the plan untouched.
  const { data: woId, error: genErr } = await db.rpc('generate_recurring_work_order_now', {
    p_id: id,
    p_expected_due: tpl.next_due_date ?? null,
    p_next: next,
    // Without a date the job never shows as Scheduled or Overdue.
    p_scheduled: tpl.next_due_date ?? todayInZone(),
  });
  if (genErr) return back('?error=' + encodeURIComponent(`Could not generate the work order: ${genErr.message}`));
  if (!woId) return back('?error=' + encodeURIComponent('This occurrence was already generated. Refresh to see the next due date.'));

  return back('?generated=1');
}
