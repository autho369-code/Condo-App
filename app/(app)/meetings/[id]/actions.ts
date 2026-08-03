'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireWorkspaceStaff } from '@/lib/auth/me';
import { isScopedStoragePath } from '@/lib/security/storage-paths';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const BUCKET = 'association-documents';
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);
const AGENDA_CATEGORIES = new Set([
  'general',
  'financial',
  'operations',
  'governance',
  'compliance',
  'old_business',
  'new_business',
  'executive_session',
]);
const ACTION_STATUSES = new Set(['open', 'in_progress', 'blocked', 'completed', 'cancelled']);

function back(meetingId: string, params = ''): never {
  redirect(`/meetings/${meetingId}${params}`);
}

function text(formData: FormData, key: string, max: number): string {
  return String(formData.get(key) ?? '').trim().slice(0, max);
}

async function editableMeeting(meetingId: string) {
  const me = await requireWorkspaceStaff();
  const supabase = await createClient();
  const { data: meeting, error } = await (supabase as any)
    .from('meetings')
    .select('id, portfolio_id, association_id, status')
    .eq('id', meetingId)
    .maybeSingle();
  if (error || !meeting) back(meetingId, '?error=Meeting%20is%20unavailable%20or%20outside%20your%20access.');
  return { me, supabase, meeting };
}

function refresh(meetingId: string) {
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath(`/board/meetings/${meetingId}`);
}

export async function saveMeetingNotes(meetingId: string, formData: FormData) {
  const { supabase } = await editableMeeting(meetingId);
  const { error } = await (supabase as any).from('meetings').update({
    minutes: text(formData, 'minutes', 100_000) || null,
    agenda: text(formData, 'agenda', 50_000) || null,
  }).eq('id', meetingId);
  if (error) back(meetingId, '?error=Meeting%20notes%20could%20not%20be%20saved.');
  refresh(meetingId);
  back(meetingId, '?saved=notes');
}

export async function addMeetingAttendee(meetingId: string, formData: FormData) {
  const { supabase } = await editableMeeting(meetingId);
  const attendeeName = text(formData, 'attendee_name', 200);
  if (!attendeeName) back(meetingId, '?error=Enter%20an%20attendee%20name.');
  const ownerId = text(formData, 'owner_id', 100) || null;
  const { error } = await (supabase as any).from('meeting_attendees').insert({
    meeting_id: meetingId,
    attendee_name: attendeeName,
    attendee_role: text(formData, 'attendee_role', 100) || null,
    owner_id: ownerId,
    present: true,
    voting_eligible: formData.get('voting_eligible') === 'on',
    check_in_time: new Date().toISOString(),
  });
  if (error) back(meetingId, '?error=The%20attendee%20could%20not%20be%20signed%20in.');
  refresh(meetingId);
  back(meetingId, '?saved=attendee');
}

export async function removeMeetingAttendee(meetingId: string, attendeeId: string) {
  const { supabase } = await editableMeeting(meetingId);
  const { error } = await (supabase as any).from('meeting_attendees')
    .delete().eq('id', attendeeId).eq('meeting_id', meetingId);
  if (error) back(meetingId, '?error=The%20attendee%20could%20not%20be%20removed.');
  refresh(meetingId);
  back(meetingId, '?saved=attendee');
}

export async function addAgendaItem(meetingId: string, formData: FormData) {
  const { supabase, meeting } = await editableMeeting(meetingId);
  if (meeting.status === 'completed' || meeting.status === 'cancelled') {
    back(meetingId, '?error=A%20finalized%20meeting%20agenda%20cannot%20be%20changed.');
  }
  const title = text(formData, 'title', 255);
  if (!title) back(meetingId, '?error=Enter%20an%20agenda%20item%20title.');
  const categoryInput = text(formData, 'category', 50);
  const category = AGENDA_CATEGORIES.has(categoryInput) ? categoryInput : 'general';
  const durationInput = Number.parseInt(text(formData, 'duration_minutes', 5), 10);
  const durationMinutes = Number.isFinite(durationInput) && durationInput >= 1 && durationInput <= 480
    ? durationInput
    : null;
  const { data: last } = await (supabase as any).from('agenda_items')
    .select('sort_order').eq('meeting_id', meetingId).order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { error } = await (supabase as any).from('agenda_items').insert({
    meeting_id: meetingId,
    title,
    description: text(formData, 'description', 5000) || null,
    category,
    duration_minutes: durationMinutes,
    presenter: text(formData, 'presenter', 200) || null,
    sort_order: Number(last?.sort_order ?? -1) + 1,
  });
  if (error) back(meetingId, '?error=The%20agenda%20item%20could%20not%20be%20added.');
  refresh(meetingId);
  back(meetingId, '?saved=agenda');
}

export async function removeAgendaItem(meetingId: string, agendaItemId: string) {
  const { supabase, meeting } = await editableMeeting(meetingId);
  if (meeting.status === 'completed' || meeting.status === 'cancelled') {
    back(meetingId, '?error=A%20finalized%20meeting%20agenda%20cannot%20be%20changed.');
  }
  const { error } = await (supabase as any).from('agenda_items')
    .delete().eq('id', agendaItemId).eq('meeting_id', meetingId);
  if (error) back(meetingId, '?error=The%20agenda%20item%20could%20not%20be%20removed.');
  refresh(meetingId);
  back(meetingId, '?saved=agenda');
}

export async function moveAgendaItem(meetingId: string, agendaItemId: string, direction: 'up' | 'down') {
  const { supabase, meeting } = await editableMeeting(meetingId);
  if (meeting.status === 'completed' || meeting.status === 'cancelled') {
    back(meetingId, '?error=A%20finalized%20meeting%20agenda%20cannot%20be%20changed.');
  }
  const { data: items, error: listError } = await (supabase as any).from('agenda_items')
    .select('id').eq('meeting_id', meetingId).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (listError || !items) back(meetingId, '?error=The%20agenda%20could%20not%20be%20reordered.');
  const ids = items.map((item: { id: string }) => item.id);
  const index = ids.indexOf(agendaItemId);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) back(meetingId);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  const { error } = await (supabase as any).rpc('reorder_agenda_items', {
    p_meeting_id: meetingId,
    p_item_ids: ids,
  });
  if (error) back(meetingId, '?error=The%20agenda%20could%20not%20be%20reordered.');
  refresh(meetingId);
  back(meetingId, '?saved=agenda');
}

export async function addMeetingDocument(meetingId: string, formData: FormData) {
  const { me, supabase } = await editableMeeting(meetingId);
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) back(meetingId, '?error=Choose%20a%20file%20to%20attach.');
  if (file.size > MAX_DOCUMENT_BYTES) back(meetingId, '?error=Attachments%20are%20limited%20to%2025%20MB.');
  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) back(meetingId, '?error=This%20file%20type%20is%20not%20supported.');

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180) || 'document';
  const path = `meetings/${meetingId}/${randomUUID()}-${safeName}`;
  const service = createServiceClient() as any;
  const { error: uploadError } = await service.storage.from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) back(meetingId, '?error=The%20document%20upload%20failed.');

  const { error } = await (supabase as any).from('meeting_documents').insert({
    meeting_id: meetingId,
    name: file.name.slice(0, 255),
    storage_path: path,
    file_size: file.size,
    file_type: file.type,
    uploaded_by: me.auth_user_id,
    uploaded_at: new Date().toISOString(),
  });
  if (error) {
    await service.storage.from(BUCKET).remove([path]);
    back(meetingId, '?error=The%20document%20record%20could%20not%20be%20saved.');
  }
  refresh(meetingId);
  back(meetingId, '?saved=document');
}

export async function removeMeetingDocument(meetingId: string, documentId: string) {
  const { supabase } = await editableMeeting(meetingId);
  const { data: document, error: readError } = await (supabase as any).from('meeting_documents')
    .select('id, storage_path').eq('id', documentId).eq('meeting_id', meetingId).maybeSingle();
  if (readError || !document || !isScopedStoragePath(document.storage_path, 'meetings', meetingId)) {
    back(meetingId, '?error=The%20document%20is%20unavailable%20or%20outside%20your%20access.');
  }
  const { error } = await (supabase as any).from('meeting_documents')
    .delete().eq('id', documentId).eq('meeting_id', meetingId);
  if (error) back(meetingId, '?error=The%20document%20could%20not%20be%20removed.');
  const service = createServiceClient() as any;
  const { error: storageError } = await service.storage.from(BUCKET).remove([document.storage_path]);
  if (storageError) console.error('Meeting document object cleanup failed', { documentId });
  refresh(meetingId);
  back(meetingId, '?saved=document');
}

export async function addMeetingActionItem(meetingId: string, formData: FormData) {
  const { me, supabase } = await editableMeeting(meetingId);
  const title = text(formData, 'title', 255);
  if (!title) back(meetingId, '?error=Enter%20a%20follow-up%20action.');
  const dueDate = text(formData, 'due_date', 10) || null;
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) back(meetingId, '?error=Enter%20a%20valid%20due%20date.');
  const { error } = await (supabase as any).from('meeting_action_items').insert({
    meeting_id: meetingId,
    title,
    description: text(formData, 'description', 5000) || null,
    assigned_to: text(formData, 'assigned_to', 200) || null,
    due_date: dueDate,
    status: 'open',
    created_by: me.auth_user_id,
  });
  if (error) back(meetingId, '?error=The%20follow-up%20action%20could%20not%20be%20added.');
  refresh(meetingId);
  back(meetingId, '?saved=action');
}

export async function updateMeetingActionStatus(meetingId: string, actionItemId: string, formData: FormData) {
  const { me, supabase } = await editableMeeting(meetingId);
  const requested = text(formData, 'status', 30);
  if (!ACTION_STATUSES.has(requested)) back(meetingId, '?error=Choose%20a%20valid%20action%20status.');
  const completed = requested === 'completed';
  const { error } = await (supabase as any).from('meeting_action_items').update({
    status: requested,
    completed_at: completed ? new Date().toISOString() : null,
    completed_by: completed ? me.auth_user_id : null,
    updated_at: new Date().toISOString(),
  }).eq('id', actionItemId).eq('meeting_id', meetingId);
  if (error) back(meetingId, '?error=The%20action%20status%20could%20not%20be%20updated.');
  refresh(meetingId);
  back(meetingId, '?saved=action');
}

export async function removeMeetingActionItem(meetingId: string, actionItemId: string) {
  const { supabase } = await editableMeeting(meetingId);
  const { error } = await (supabase as any).from('meeting_action_items')
    .delete().eq('id', actionItemId).eq('meeting_id', meetingId);
  if (error) back(meetingId, '?error=The%20follow-up%20action%20could%20not%20be%20removed.');
  refresh(meetingId);
  back(meetingId, '?saved=action');
}
