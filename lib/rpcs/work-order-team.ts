'use server';

// In-house maintenance assignment. The assignee must be an active staff member
// of the caller's own company — taken from mentionable_staff(), which only
// returns the caller's company — and the work order update runs through the
// caller's RLS-scoped client (association-scoped managers only reach theirs).

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { workOrderStaff } from '@/lib/maintenance/staff';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function assignWorkOrderToStaff(workOrderId: string, formData: FormData) {
  await requireStaff();
  const back = `/work-orders/${workOrderId}`;
  const fail = (msg: string): never => redirect(`${back}?error=${encodeURIComponent(msg)}`);
  if (!UUID.test(workOrderId)) fail('Unknown work order');
  const userId = String(formData.get('assignee_id') ?? '');
  const db = (await createClient()) as any;

  let name: string | null = null;
  if (userId) {
    if (!UUID.test(userId)) fail('Pick a team member');
    name = (await workOrderStaff(db, workOrderId)).get(userId) ?? null;
    if (!name) fail('That person can’t see this association’s work orders');
  }

  const { data: updated, error } = await db.from('work_orders')
    .update({ assignee_id: userId || null, assigned_to: name })
    .eq('id', workOrderId).is('archived_at', null)
    .select('id').maybeSingle();
  if (error || !updated) fail(error?.message ?? 'Work order not found');

  await db.from('work_order_updates').insert({
    work_order_id: workOrderId,
    note: name ? `Assigned in-house to ${name}` : 'In-house assignee removed',
  });
  revalidatePath(back);
  revalidatePath('/work-orders');
  revalidatePath('/work-orders/team');
  redirect(back);
}
