'use server';

// Mark an owner as a board member (and end a seat) from the owner detail page.
// Access is immediate: is_board_user() reads active board_members rows, so the
// owner's existing login gains the board portal with no re-invite or role flip.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';

const BOARD_ROLES = ['president', 'vice_president', 'secretary', 'treasurer', 'director'] as const;

export async function addOwnerToBoard(ownerId: string, formData: FormData) {
  await requireStaff();
  const back = `/owners/${ownerId}`;
  const failTo = (msg: string): never => redirect(`${back}?error=${encodeURIComponent(msg)}`);

  const associationId = (formData.get('association_id') as string)?.trim();
  const role = (formData.get('role') as string)?.trim();
  const termStart = (formData.get('term_start') as string) || null;
  const termEnd = (formData.get('term_end') as string) || null;

  if (!associationId) failTo('Choose the association this board seat belongs to.');
  if (!BOARD_ROLES.includes(role as any)) failTo('Choose a valid board role.');
  if (termStart && termEnd && termEnd <= termStart) failTo('Term end must be after term start.');

  const supabase = await createClient();
  const db = supabase as any;

  const { data: owner } = await db
    .from('owners')
    .select('id, full_name, email, phone, auth_user_id')
    .eq('id', ownerId)
    .is('archived_at', null)
    .maybeSingle();
  if (!owner) failTo('Owner not found.');

  const { data: existing } = await db
    .from('board_members')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('association_id', associationId)
    .eq('active', true)
    .limit(1);
  if ((existing ?? []).length > 0) failTo('This owner already holds an active seat on that board.');

  const { error } = await db.from('board_members').insert({
    association_id: associationId,
    owner_id: ownerId,
    full_name: owner.full_name,
    email: owner.email,
    phone: owner.phone ?? null,
    role,
    term_start: termStart,
    term_end: termEnd,
    active: true,
    // Link to the owner's existing login so board access works immediately
    auth_user_id: owner.auth_user_id ?? null,
  });
  if (error) failTo(error.message);

  revalidatePath(back);
  redirect(`${back}?saved=board`);
}

export async function endBoardSeat(ownerId: string, formData: FormData) {
  await requireStaff();
  const back = `/owners/${ownerId}`;
  const seatId = (formData.get('seat_id') as string)?.trim();
  if (!seatId) redirect(`${back}?error=${encodeURIComponent('Missing board seat.')}`);

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('board_members')
    .update({ active: false, term_end: new Date().toISOString().slice(0, 10) })
    .eq('id', seatId)
    .eq('owner_id', ownerId);
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(back);
  redirect(`${back}?saved=board_end`);
}
