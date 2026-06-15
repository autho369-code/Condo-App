import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';

export const dynamic = 'force-dynamic';

/**
 * Pause / resume a recurring work order by flipping auto_generate. The list UI
 * derives "Active" vs "Paused" from auto_generate, so this is the on/off switch.
 */
export async function POST(req: NextRequest) {
  await requireStaff();
  const form = await req.formData();
  const id = form.get('id') as string | null;
  const action = (form.get('action') as string | null) ?? null;

  const origin = new URL(req.url).origin;
  const back = (params = '') => NextResponse.redirect(`${origin}/recurring-work-orders${params}`, { status: 303 });

  if (!id) return back('?error=' + encodeURIComponent('Missing recurring work order id.'));

  const supabase = await createClient();
  const db = supabase as any;

  let nextAutoGenerate: boolean;
  if (action === 'pause') nextAutoGenerate = false;
  else if (action === 'resume') nextAutoGenerate = true;
  else {
    // No explicit action — read current state and flip it.
    const { data: tpl } = await db
      .from('recurring_work_orders')
      .select('auto_generate')
      .eq('id', id)
      .maybeSingle();
    if (!tpl) return back('?error=' + encodeURIComponent('Recurring work order not found.'));
    nextAutoGenerate = !tpl.auto_generate;
  }

  const { error } = await db
    .from('recurring_work_orders')
    .update({ auto_generate: nextAutoGenerate })
    .eq('id', id);
  if (error) return back('?error=' + encodeURIComponent(error.message));

  return back(nextAutoGenerate ? '?resumed=1' : '?paused=1');
}
