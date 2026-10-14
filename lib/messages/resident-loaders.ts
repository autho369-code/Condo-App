import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ResidentThreadRow, ThreadMessage } from '@/components/messages/resident-messages';

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/**
 * Which resident identity a portal page speaks for. Filtering by it matters
 * because a person who is also staff can read every company thread under RLS;
 * the portal must still only show their own conversations.
 */
export type ResidentParty = { kind: 'owner'; ownerIds: string[] } | { kind: 'tenant'; tenantIds: string[] };

export async function tenantParty(): Promise<ResidentParty> {
  const db = (await createClient()) as any;
  const { data } = await db.rpc('current_tenant_ids');
  const ids = (Array.isArray(data) ? data : [])
    .map((row: any) => (typeof row === 'string' ? row : row?.current_tenant_ids))
    .filter(Boolean) as string[];
  return { kind: 'tenant', tenantIds: ids };
}

function scoped(query: any, party: ResidentParty) {
  if (party.kind === 'owner') return query.in('owner_id', party.ownerIds.length ? party.ownerIds : ['00000000-0000-0000-0000-000000000000']);
  return query.in('tenant_id', party.tenantIds.length ? party.tenantIds : ['00000000-0000-0000-0000-000000000000']);
}

/**
 * Units the resident can write about, labelled "Association · Unit 101", plus
 * the read error (a failed read must not read as "not linked to a unit").
 */
export async function residentUnitOptions(unitIds: string[]): Promise<{ units: { id: string; label: string }[]; error: string | null }> {
  if (!unitIds.length) return { units: [], error: null };
  const db = (await createClient()) as any;
  const { data, error } = await db.from('units')
    .select('id, unit_number, buildings(associations(name))')
    .in('id', unitIds);
  if (error) return { units: [], error: `Could not load your units: ${error.message ?? 'unknown error'}` };
  return {
    units: ((data ?? []) as any[]).map((u) => {
      const assoc = one<any>(one<any>(u.buildings)?.associations);
      return { id: u.id as string, label: `${assoc?.name ? `${assoc.name} · ` : ''}Unit ${u.unit_number ?? '—'}` };
    }),
    error: null,
  };
}

/**
 * The resident's own threads, plus the read error. Pages render the error in
 * an <Alert> and must not open "compose" as if there were no threads.
 */
export async function residentThreads(party: ResidentParty): Promise<{ threads: ResidentThreadRow[]; error: string | null }> {
  const db = (await createClient()) as any;
  const { data, error } = await scoped(db.from('message_threads')
    .select('id, subject, status, last_message_at, last_message_preview, last_message_role, resident_unread'), party)
    .order('last_message_at', { ascending: false })
    .limit(200);
  if (error) return { threads: [], error: `Could not load your messages: ${error.message ?? 'unknown error'}` };
  return { threads: (data ?? []) as ResidentThreadRow[], error: null };
}

/** One of the resident's threads + its non-internal messages, marked read. */
export async function residentThread(threadId: string, party: ResidentParty) {
  const db = (await createClient()) as any;
  const { data: thread } = await scoped(db.from('message_threads').select('id, subject, status').eq('id', threadId), party).maybeSingle();
  if (!thread) return null;
  const { data: messages } = await db.from('message_thread_messages')
    .select('id, author_role, author_name, body, created_at')
    .eq('thread_id', threadId).eq('internal', false)
    .order('created_at', { ascending: true });
  await db.rpc('mark_message_thread_read', { p_thread: threadId, p_as: 'resident' });
  return { thread: thread as { id: string; subject: string; status: string }, messages: (messages ?? []) as ThreadMessage[] };
}
