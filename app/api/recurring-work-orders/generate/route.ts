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
  const me = await requireStaff();
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

  const { error: insErr } = await db.from('work_orders').insert({
    portfolio_id: tpl.portfolio_id,
    association_id: tpl.association_id,
    unit_id: tpl.unit_id,
    vendor_id: tpl.vendor_id,
    title: tpl.title,
    description: tpl.description,
    category: tpl.category ?? 'other',
    priority: tpl.priority ?? 'normal',
    trade: tpl.trade,
    // Without a date the job never shows as Scheduled or Overdue; with a
    // vendor on the plan it is already assigned.
    scheduled_date: tpl.next_due_date ?? todayInZone(),
    status: tpl.vendor_id ? 'assigned' : 'new',
    created_by: me.auth_user_id,
  });
  if (insErr) return back('?error=' + encodeURIComponent(insErr.message));

  // Same schedule rule as the nightly generator (anchored on the start day).
  const base = tpl.next_due_date ?? todayInZone();
  const anchorDay = Number(String(tpl.start_date ?? base).slice(8, 10)) || null;
  const next = nextRecurringDate(base, tpl.frequency ?? 'monthly', tpl.interval_count ?? 1, anchorDay);
  if (!next) return back('?error=' + encodeURIComponent('Work order created, but this plan has an unknown frequency.'));
  const { error: advanceErr } = await db
    .from('recurring_work_orders')
    .update({
      last_generated_at: new Date().toISOString(),
      next_due_date: next,
    })
    .eq('id', id);
  if (advanceErr) {
    return back('?error=' + encodeURIComponent(`Work order created, but the next due date was not advanced: ${advanceErr.message}`));
  }

  return back('?generated=1');
}
