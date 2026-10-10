// Resident side of the message center, shared by the owner portal
// (/portal/messages) and the tenant portal (/resident/messages).
import Link from 'next/link';
import { MessageSquare, Send } from 'lucide-react';
import { Alert, EmptyState, PageHeader, Surface } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { StatusChip } from '@/components/operations/status-chip';
import { startResidentConversation, replyAsResident } from '@/lib/rpcs/messages';

export interface ResidentThreadRow {
  id: string;
  subject: string;
  status: string;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_role: string | null;
  resident_unread: boolean;
}

export interface ThreadMessage {
  id: string;
  author_role: 'resident' | 'staff';
  author_name: string | null;
  body: string;
  internal?: boolean;
  created_at: string;
}

function when(ts: string) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function ResidentConversationList({
  base, threads, units, error, compose,
}: {
  base: '/portal/messages' | '/resident/messages';
  threads: ResidentThreadRow[];
  units: { id: string; label: string }[];
  error?: string;
  compose?: boolean;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Ask your management team anything — billing, documents, insurance, move-ins. For something broken, submit a service request instead."
        actions={!compose ? <Link href={`${base}?compose=1`}><Button><Send className="h-4 w-4" /> New message</Button></Link> : null}
      />
      {error ? <Alert>{error}</Alert> : null}

      {compose ? (
        <Surface>
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">New message</h2>
          {units.length === 0 ? (
            <Alert tone="warning" className="mt-4">Your account isn&apos;t linked to a unit yet. Contact management.</Alert>
          ) : (
            <form action={startResidentConversation} className="mt-4 space-y-4">
              <input type="hidden" name="base" value={base} />
              {units.length === 1 ? <input type="hidden" name="unit_id" value={units[0].id} /> : (
                <div>
                  <Label htmlFor="unit_id">About</Label>
                  <select id="unit_id" name="unit_id" required
                    className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                    {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
                </div>
              )}
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" name="subject" required maxLength={150} placeholder="e.g. Copy of my ledger" />
              </div>
              <div>
                <Label htmlFor="body">Message</Label>
                <Textarea id="body" name="body" required maxLength={5000} rows={6} />
              </div>
              <div className="flex justify-end gap-2">
                <Link href={base}><Button type="button" variant="secondary">Cancel</Button></Link>
                <Button type="submit"><Send className="h-4 w-4" /> Send</Button>
              </div>
            </form>
          )}
        </Surface>
      ) : null}

      <Surface padded={false}>
        {threads.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No messages yet" description="Conversations with your management team show up here." />
        ) : (
          <ul className="divide-y divide-line">
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={`${base}/${t.id}`} className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-gray-50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {t.resident_unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" /> : null}
                      <span className={`truncate text-sm ${t.resident_unread ? 'font-semibold text-gray-950' : 'font-medium text-gray-900'}`}>{t.subject}</span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-gray-500">
                      {t.last_message_role === 'staff' ? 'Management: ' : 'You: '}{t.last_message_preview}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[13px] text-gray-500">{when(t.last_message_at)}</div>
                    {t.status === 'closed' ? <div className="mt-1"><StatusChip>closed</StatusChip></div> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
}

export function MessageList({ messages, viewer }: { messages: ThreadMessage[]; viewer: 'resident' | 'staff' }) {
  return (
    <ul className="space-y-3">
      {messages.map((m) => {
        const mine = m.author_role === viewer;
        return (
          <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              m.internal ? 'border border-amber-200 bg-amber-50 text-amber-900'
                : mine ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-900'}`}>
              <div className={`mb-1 text-xs ${mine && !m.internal ? 'text-gray-300' : 'text-gray-500'}`}>
                {m.internal ? 'Internal note · ' : ''}{m.author_name ?? (m.author_role === 'staff' ? 'Management' : 'Resident')} · {when(m.created_at)}
              </div>
              <p className="whitespace-pre-wrap leading-6">{m.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ResidentConversation({
  base, thread, messages, sent, error,
}: {
  base: '/portal/messages' | '/resident/messages';
  thread: { id: string; subject: string; status: string };
  messages: ThreadMessage[];
  sent?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-6">
      <Link href={base} className="text-[13px] font-medium text-gray-500 hover:text-gray-900">← All messages</Link>
      <PageHeader title={thread.subject} actions={thread.status === 'closed' ? <StatusChip>closed</StatusChip> : null} />
      {sent ? <Alert tone="success">Sent. Your management team has been notified.</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}
      <Surface>
        <MessageList messages={messages} viewer="resident" />
      </Surface>
      <Surface>
        <form action={replyAsResident.bind(null, thread.id)} className="space-y-3">
          <input type="hidden" name="base" value={base} />
          <Label htmlFor="body">{thread.status === 'closed' ? 'Reply (reopens the conversation)' : 'Reply'}</Label>
          <Textarea id="body" name="body" required maxLength={5000} rows={4} />
          <div className="flex justify-end"><Button type="submit"><Send className="h-4 w-4" /> Send</Button></div>
        </form>
      </Surface>
    </div>
  );
}
