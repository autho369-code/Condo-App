'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Allow email to an address again after it bounced (staff fixed or confirmed
 * it). The database checks the bounce is in the caller's company and refuses
 * an unsubscribe or spam report, which only the recipient can undo.
 */
export async function clearEmailBounce(formData: FormData) {
  await requireStaff();
  const emailId = String(formData.get('email_id') ?? '');
  const suppressionId = String(formData.get('suppression_id') ?? '');
  const back = UUID.test(emailId) ? `/communication-center/emails/${emailId}` : '/communication-center';
  if (!UUID.test(suppressionId)) redirect(`${back}?error=${encodeURIComponent('Choose the bounced address to allow again.')}`);

  const db = (await createClient()) as any;
  const { error } = await db.rpc('clear_email_bounce', { p_suppression_id: suppressionId });
  if (error) redirect(`${back}?error=${encodeURIComponent(`Could not allow email to this address: ${error.message}`)}`);
  revalidatePath(back);
  redirect(`${back}?done=${encodeURIComponent('Email to this address is allowed again. New emails will be sent; this one was not resent.')}`);
}
