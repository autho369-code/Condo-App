import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';

export const dynamic = 'force-dynamic';

// Advance a date by one interval of the given frequency.
function advance(from: Date, frequency: string, interval: number): Date {
  const d = new Date(from);
  const n = Number.isFinite(interval) && interval > 0 ? interval : 1;
  switch (frequency) {
    case 'daily': d.setDate(d.getDate() + n); break;
    case 'weekly': d.setDate(d.getDate() + 7 * n); break;
    case 'monthly': d.setMonth(d.getMonth() + n); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3 * n); break;
    case 'annually': d.setFullYear(d.getFullYear() + n); break;
    default: d.setMonth(d.getMonth() + n); break;
  }
  return d;
}

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
    status: 'new',
    created_by: me.auth_user_id,
  });
  if (insErr) return back('?error=' + encodeURIComponent(insErr.message));

  const base = tpl.next_due_date ? new Date(tpl.next_due_date) : new Date();
  const next = advance(base, tpl.frequency ?? 'monthly', tpl.interval_count ?? 1);
  await db
    .from('recurring_work_orders')
    .update({
      last_generated_at: new Date().toISOString(),
      next_due_date: next.toISOString().slice(0, 10),
    })
    .eq('id', id);

  return back('?generated=1');
}
