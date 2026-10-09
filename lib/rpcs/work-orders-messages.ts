'use server';
import { createClient } from '@/lib/supabase/server';
import { requireOwner, requireStaff, requireVendor } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ownerTenureCutoffs, withinTenure } from '@/app/portal/_lib/tenure';

/**
 * Post a message to a work order's discussion thread. Works for owner, staff,
 * board, and vendor — the caller passes the basePath so we redirect back to
 * the right surface. Modeled on postArchitecturalMessage.
 *
 * The author role is ALWAYS derived from the session, never from the client,
 * so a resident cannot post as "staff" and a vendor cannot post as "board".
 * RLS on work_order_messages then re-checks that the derived role may write
 * to this specific work order (own unit / own portfolio / own assignment).
 */
export async function postWorkOrderMessage(
  workOrderId: string,
  basePath: string,
  formData: FormData,
) {
  const context = basePath === '/portal/work-orders'
    ? { me: await requireOwner(), authorRole: 'owner' as const }
    : basePath === '/vendor/work-orders'
      ? { me: await requireVendor(), authorRole: 'vendor' as const }
      : basePath === '/work-orders'
        ? { me: await requireStaff(), authorRole: 'staff' as const }
        : null;
  if (!context) { redirect('/?error=' + encodeURIComponent('Invalid work-order return path')); return; }
  const { me, authorRole } = context;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(workOrderId))) {
    redirect(`${basePath}?error=${encodeURIComponent('That work order is not available.')}`);
    return;
  }
  const back = `${basePath}/${workOrderId}`;

  const body = (formData.get('body') as string)?.trim();
  if (!body) { redirect(`${back}?error=${encodeURIComponent('Message cannot be empty')}`); return; }

  const supabase = await createClient();
  // An owner may only post on work orders from their own time at the unit
  // (a buyer never joins the seller's threads; the detail page 404s them too).
  if (authorRole === 'owner') {
    const { data: wo, error: woError } = await (supabase as any)
      .from('work_orders').select('unit_id, created_at').eq('id', workOrderId).maybeSingle();
    if (woError) { redirect(`${back}?error=${encodeURIComponent(woError.message)}`); return; }
    const tenure = await ownerTenureCutoffs(supabase, me.owner_id);
    if (!wo || !withinTenure(tenure, wo.unit_id, wo.created_at)) {
      redirect(`/portal/work-orders?error=${encodeURIComponent('That work order is not available.')}`);
      return;
    }
  }
  // A vendor may only post on an active work order assigned to them (bound
  // action arguments come back from the browser, so re-check here; RLS on
  // work_order_messages enforces the same rule).
  if (authorRole === 'vendor') {
    const { data: wo, error: woError } = await (supabase as any)
      .from('work_orders').select('id')
      .eq('id', workOrderId).in('vendor_id', me.vendor_ids).is('archived_at', null)
      .maybeSingle();
    if (woError) { redirect(`${back}?error=${encodeURIComponent(woError.message)}`); return; }
    if (!wo) {
      redirect(`/vendor/work-orders?error=${encodeURIComponent('That work order is not available.')}`);
      return;
    }
  }
  const { error } = await (supabase as any).from('work_order_messages').insert({
    work_order_id: workOrderId,
    author_id:     me.auth_user_id,
    author_name:   me.profile?.full_name ?? me.email ?? null,
    author_role:   authorRole,
    body,
  });
  if (error) { redirect(`${back}?error=${encodeURIComponent(error.message)}`); return; }
  revalidatePath(back);
}
