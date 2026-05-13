'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireStaff } from '@/lib/auth/me';
import { normalizeBoardMemberForm, type BoardMemberInsert } from '@/lib/associations/board-members';
import { createClient } from '@/lib/supabase/server';

export async function addBoardMember(associationId: string, formData: FormData) {
  await requireStaff();
  const supabase = await createClient();

  let payload: BoardMemberInsert;
  try {
    payload = normalizeBoardMemberForm(associationId, formData);
  } catch (error) {
    redirect(`/associations/${associationId}/board?board_error=${encodeURIComponent(error instanceof Error ? error.message : 'Could not add board member')}`);
  }

  const { error } = await (supabase as any).from('board_members').insert(payload);
  if (error) {
    redirect(`/associations/${associationId}/board?board_error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/associations/${associationId}/board`);
  revalidatePath(`/associations/${associationId}/profile`);
  redirect(`/associations/${associationId}/board?board_added=1`);
}
