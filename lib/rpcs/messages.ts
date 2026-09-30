'use server';

// Resident <-> management messaging. Every write goes through a SECURITY
// DEFINER function that re-checks who the caller is for that thread (the
// resident party, or staff scoped to its association), so these actions only
// validate input and route the result.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, requireStaff } from '@/lib/auth/me';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Where resident-side forms may send people back to. */
const RESIDENT_BASES = new Set(['/portal/messages', '/resident/messages']);

function residentBase(formData: FormData) {
  const base = String(formData.get('base') ?? '');
  return RESIDENT_BASES.has(base) ? base : '/portal/messages';
}

function text(formData: FormData, name: string, max: number) {
  return String(formData.get(name) ?? '').trim().slice(0, max);
}

function refresh(threadId?: string) {
  revalidatePath('/inbox');
  revalidatePath('/portal/messages');
  revalidatePath('/resident/messages');
  if (threadId) {
    revalidatePath(`/inbox/${threadId}`);
    revalidatePath(`/portal/messages/${threadId}`);
    revalidatePath(`/resident/messages/${threadId}`);
  }
}

export async function startResidentConversation(formData: FormData) {
  await requireAuth();
  const base = residentBase(formData);
  const fail = (msg: string): never => redirect(`${base}?error=${encodeURIComponent(msg)}`);
  const unitId = String(formData.get('unit_id') ?? '');
  const subject = text(formData, 'subject', 150);
  const body = text(formData, 'body', 5000);
  if (!UUID.test(unitId)) fail('Pick your unit');
  if (!subject) fail('Add a subject');
  if (!body) fail('Write your message');
  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('start_resident_message_thread', { p_unit: unitId, p_subject: subject, p_body: body });
  if (error || !data) fail(error?.message ?? 'Could not send your message');
  refresh(data);
  redirect(`${base}/${data}?sent=1`);
}

export async function replyAsResident(threadId: string, formData: FormData) {
  await requireAuth();
  const base = residentBase(formData);
  const back = `${base}/${threadId}`;
  if (!UUID.test(threadId)) redirect(base);
  const body = text(formData, 'body', 5000);
  if (!body) redirect(`${back}?error=${encodeURIComponent('Write your message')}`);
  const db = (await createClient()) as any;
  const { error } = await db.rpc('post_message', { p_thread: threadId, p_body: body, p_internal: false });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  refresh(threadId);
  redirect(`${back}?sent=1`);
}

export async function replyAsStaff(threadId: string, formData: FormData) {
  await requireStaff();
  const back = `/inbox/${threadId}`;
  if (!UUID.test(threadId)) redirect('/inbox');
  const body = text(formData, 'body', 5000);
  const internal = formData.get('internal') === 'on';
  if (!body) redirect(`${back}?error=${encodeURIComponent('Write a message')}`);
  const db = (await createClient()) as any;
  const { error } = await db.rpc('post_message', { p_thread: threadId, p_body: body, p_internal: internal });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  if (formData.get('close_after') === 'on' && !internal) {
    await db.rpc('set_message_thread_status', { p_thread: threadId, p_status: 'closed' });
  }
  refresh(threadId);
  redirect(`${back}?saved=${internal ? 'note' : 'sent'}`);
}

export async function setConversationStatus(threadId: string, status: 'open' | 'closed') {
  await requireStaff();
  if (!UUID.test(threadId)) redirect('/inbox');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('set_message_thread_status', { p_thread: threadId, p_status: status });
  if (error) redirect(`/inbox/${threadId}?error=${encodeURIComponent(error.message)}`);
  refresh(threadId);
  redirect(`/inbox/${threadId}?saved=${status}`);
}

export async function assignConversation(threadId: string, formData: FormData) {
  await requireStaff();
  if (!UUID.test(threadId)) redirect('/inbox');
  const userId = String(formData.get('assigned_to') ?? '');
  if (userId && !UUID.test(userId)) redirect(`/inbox/${threadId}?error=${encodeURIComponent('Pick a team member')}`);
  const db = (await createClient()) as any;
  const { error } = await db.rpc('assign_message_thread', { p_thread: threadId, p_user: userId || null });
  if (error) redirect(`/inbox/${threadId}?error=${encodeURIComponent(error.message)}`);
  refresh(threadId);
  redirect(`/inbox/${threadId}?saved=assigned`);
}

export async function startStaffConversation(formData: FormData) {
  await requireStaff();
  const ownerId = String(formData.get('owner_id') ?? '');
  const tenantId = String(formData.get('tenant_id') ?? '');
  const back = `/inbox/new?${ownerId ? `owner=${ownerId}` : `tenant=${tenantId}`}`;
  const fail = (msg: string): never => redirect(`${back}&error=${encodeURIComponent(msg)}`);
  if (!!ownerId === !!tenantId || (ownerId && !UUID.test(ownerId)) || (tenantId && !UUID.test(tenantId))) fail('Pick who to message');
  const subject = text(formData, 'subject', 150);
  const body = text(formData, 'body', 5000);
  if (!subject) fail('Add a subject');
  if (!body) fail('Write a message');
  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('start_staff_message_thread', {
    p_owner: ownerId || null, p_tenant: tenantId || null, p_subject: subject, p_body: body,
  });
  if (error || !data) fail(error?.message ?? 'Could not send the message');
  refresh(data);
  redirect(`/inbox/${data}?saved=sent`);
}
