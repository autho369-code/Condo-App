'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';

export async function addInternalNote(formData: FormData) {
  const ticketId = formData.get('ticket_id') as string;
  const body = (formData.get('body') as string)?.trim();
  if (!ticketId || !body) return;

  const serviceClient = await createServiceClient();
  await (serviceClient as any)
    .from('ticket_comments')
    .insert({
      ticket_id: ticketId,
      body,
      author_id: null,
      created_at: new Date().toISOString(),
    });
  revalidatePath('/platform/support');
}

export async function markTicketResolved(formData: FormData) {
  const ticketId = formData.get('ticket_id') as string;
  if (!ticketId) return;

  const serviceClient = await createServiceClient();
  await (serviceClient as any)
    .from('tickets')
    .update({
      status: 'Resolved',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId);
  revalidatePath('/platform/support');
}
