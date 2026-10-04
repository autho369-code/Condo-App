import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireWorkspaceStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { MessageList, type ThreadMessage } from '@/components/messages/resident-messages';
import { ReplyComposer, type ReplyTemplate } from '@/components/messages/reply-composer';
import { buildMergeValues } from '@/lib/letters/merge';
import { assignConversation, replyAsStaff, setConversationStatus } from '@/lib/rpcs/messages';
import { responseState } from '@/lib/maintenance/intake';

export const dynamic = 'force-dynamic';

const SAVED: Record<string, string> = {
  sent: 'Sent. The resident gets it by email and in their portal.',
  note: 'Internal note added — the resident can’t see it.',
  closed: 'Conversation closed. It reopens if the resident writes again.',
  open: 'Conversation reopened.',
  assigned: 'Assignment updated.',
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function ConversationPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const me = await requireWorkspaceStaff();
  const { id } = await params;
  const sp = await searchParams;
  const db = (await createClient()) as any;

  const [{ data: t }, { data: messages }, { data: staff }, { data: templates }] = await Promise.all([
    db.from('message_threads')
      .select('id, subject, status, owner_id, tenant_id, unit_id, assigned_to, first_response_due_at, acknowledged_at, created_at, owners(full_name, email), tenants(first_name, last_name, email, phone), associations(name), units(unit_number)')
      .eq('id', id).maybeSingle(),
    db.from('message_thread_messages').select('id, author_role, author_name, body, internal, created_at').eq('thread_id', id).order('created_at'),
    db.rpc('message_thread_assignees', { p_thread: id }),
    // Saved replies for email (Inbox replies are emailed).
    db.from('message_templates').select('id, name, body')
      .eq('portfolio_id', me.portfolio?.id).in('channel', ['email', 'both']).order('name').limit(200),
  ]);
  if (!t) notFound();
  await db.rpc('mark_message_thread_read', { p_thread: id, p_as: 'staff' });

  const owner = one<any>(t.owners);
  const tenant = one<any>(t.tenants);
  const name = owner?.full_name ?? (tenant ? `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() : 'Resident');
  const email = owner?.email ?? tenant?.email ?? null;
  const mergeValues = buildMergeValues({
    association: { name: one<any>(t.associations)?.name ?? null },
    owner: { full_name: name, email: email ?? null, phone: tenant?.phone ?? null },
    unitNumbers: one<any>(t.units)?.unit_number ? [one<any>(t.units).unit_number] : [],
  });
  mergeValues.resident_name = name;
  mergeValues.manager_name = me.profile?.full_name ?? '';
  const state = t.status === 'open' ? responseState({ status: 'open', acknowledged_at: t.acknowledged_at, first_response_due_at: t.first_response_due_at }) : null;

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={<><Link href="/inbox" className="transition-colors hover:text-gray-700">Inbox</Link>{' · '}<span>{one<any>(t.associations)?.name ?? '—'}</span></>}
          title={t.subject}
          subtitle={
            <span className="flex flex-wrap items-center gap-1.5">
              <StatusChip tone={t.status === 'open' ? 'warning' : 'neutral'}>{t.status}</StatusChip>
              {state && !t.acknowledged_at ? <StatusChip tone={state.tone}>{state.label}</StatusChip> : null}
            </span>
          }
        />
      }
      rail={
        <div className="space-y-5 text-sm">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{owner ? 'Owner' : 'Tenant'}</div>
            {t.owner_id ? <Link href={`/owners/${t.owner_id}`} className="font-medium text-gray-900 hover:underline">{name}</Link> : <div className="font-medium text-gray-900">{name}</div>}
            {one<any>(t.units)?.unit_number ? <div className="text-gray-500">Unit {one<any>(t.units).unit_number}</div> : null}
            {email ? <a href={`mailto:${email}`} className="block truncate text-gray-600 hover:underline">{email}</a> : <div className="text-amber-700">No email on file — they’ll only see replies in the portal.</div>}
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Assigned to</div>
            <form action={assignConversation.bind(null, id)} className="flex gap-2">
              <select name="assigned_to" defaultValue={t.assigned_to ?? ''} aria-label="Assigned to"
                className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                <option value="">Nobody</option>
                {((staff ?? []) as Array<{ id: string; name: string }>).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Button type="submit" size="sm" variant="secondary">Save</Button>
            </form>
          </div>
          <div>
            {t.status === 'open' ? (
              <form action={setConversationStatus.bind(null, id, 'closed')}><Button type="submit" variant="secondary" className="w-full">Close conversation</Button></form>
            ) : (
              <form action={setConversationStatus.bind(null, id, 'open')}><Button type="submit" variant="secondary" className="w-full">Reopen</Button></form>
            )}
          </div>
        </div>
      }
    >
      {sp.error ? <Alert className="mb-6">{sp.error}</Alert> : null}
      {sp.saved && SAVED[sp.saved] ? <Alert tone="success" className="mb-6">{SAVED[sp.saved]}</Alert> : null}

      <Section title="Conversation">
        <div className="px-5 py-4"><MessageList messages={(messages ?? []) as ThreadMessage[]} viewer="staff" /></div>
      </Section>

      <Section title="Reply">
        <form action={replyAsStaff.bind(null, id)} className="space-y-3 px-5 py-4">
          <ReplyComposer recipientName={name} templates={(templates ?? []) as ReplyTemplate[]} mergeValues={mergeValues} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <label className="flex items-center gap-2"><input type="checkbox" name="internal" className="h-4 w-4" /> Internal note (resident won’t see it)</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="close_after" className="h-4 w-4" /> Close after sending</label>
            </div>
            <Button type="submit">Send</Button>
          </div>
        </form>
      </Section>
    </Workspace>
  );
}
