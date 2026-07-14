'use server';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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
  const me = await getMe();
  const back = `${basePath}/${workOrderId}`;
  if (!me.auth_user_id) { redirect('/login'); return; }

  const authorRole: 'owner' | 'staff' | 'board' | 'vendor' =
    (me.is_staff || me.is_platform_operator) ? 'staff'
    : me.is_board  ? 'board'
    : me.vendor_id ? 'vendor'
    : 'owner';

  const body = (formData.get('body') as string)?.trim();
  if (!body) { redirect(`${back}?error=${encodeURIComponent('Message cannot be empty')}`); return; }

  const supabase = await createClient();
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
