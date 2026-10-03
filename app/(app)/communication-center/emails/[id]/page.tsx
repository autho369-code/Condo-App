import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { SectionTitle, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { formatInZone } from '@/lib/time/zoned';

export const dynamic = 'force-dynamic';

// email_events.event_type values (lib/email/webhook-signature.ts).
const EVENT_LABEL: Record<string, string> = {
  sent: 'Sent',
  delivered: 'Delivered',
  delivery_delayed: 'Delivery delayed',
  opened: 'Opened',
  clicked: 'Link clicked',
  bounced: 'Bounced',
  complained: 'Marked as spam',
  failed: 'Failed',
};

/** The stored HTML body as plain text (shown as text, never rendered as HTML). */
function plainText(html: string | null) {
  return String(html ?? '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function when(value: string | null) {
  return value ? formatInZone(value) : '—';
}

/** One sent email: who it went to, its delivery and open history, and the message. */
export default async function SentEmailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = (await createClient()) as any;

  const [{ data: email }, { data: events }] = await Promise.all([
    db.from('email_queue')
      .select('id, to_email, to_name, from_name, from_address, reply_to, subject, body, status, error_message, attempt_count, created_at, sent_at, delivered_at, open_count, first_opened_at, last_opened_at, clicked_at, bounced_at, complained_at, associations(name)')
      .eq('id', id)
      .maybeSingle(),
    db.from('email_events').select('id, event_type, occurred_at, detail').eq('email_id', id).order('occurred_at', { ascending: true }).limit(200),
  ]);
  if (!email) notFound();

  const facts: [string, string][] = [
    ['To', email.to_name ? `${email.to_name} <${email.to_email}>` : email.to_email],
    ['From', [email.from_name, email.from_address ? `<${email.from_address}>` : ''].filter(Boolean).join(' ') || '—'],
    ['Reply to', email.reply_to ?? '—'],
    ['Association', email.associations?.name ?? '—'],
    ['Created', when(email.created_at)],
    ['Sent', when(email.sent_at)],
    ['Delivered', when(email.delivered_at)],
    ['First opened', email.first_opened_at ? `${when(email.first_opened_at)}${email.open_count > 1 ? ` · opened ${email.open_count} times` : ''}` : '—'],
    ['Link clicked', when(email.clicked_at)],
    ['Bounced', when(email.bounced_at)],
    ['Marked as spam', when(email.complained_at)],
  ];

  return (
    <DataWorkspace
      title={email.subject || 'No subject'}
      description={`Email to ${email.to_name || email.to_email}`}
      actions={<Link href="/communication-center"><Button variant="secondary">Back to Communication Center</Button></Link>}
    >
      <div className="space-y-4">
        <Surface>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {email.bounced_at ? <StatusChip tone="danger">Bounced</StatusChip>
              : email.status === 'failed' ? <StatusChip tone="danger">Failed</StatusChip>
              : email.status === 'pending' ? <StatusChip tone="warning">Waiting to send</StatusChip>
              : email.delivered_at ? <StatusChip tone="success">Delivered</StatusChip>
              : <StatusChip tone="info">Sent</StatusChip>}
            {email.status === 'failed' && email.error_message && <span className="text-sm text-red-600">{email.error_message}</span>}
            {email.status === 'pending' && email.attempt_count > 0 && <span className="text-sm text-gray-500">{email.attempt_count} attempt{email.attempt_count === 1 ? '' : 's'} so far</span>}
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-gray-500">{k}</dt>
                <dd className="break-words text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Surface>

        <Surface padded={false}>
          <div className="px-5 pt-5"><SectionTitle title="Delivery history" description="Reported by the email provider." /></div>
          {(events ?? []).length === 0 ? (
            <p className="px-5 pb-6 pt-2 text-sm text-gray-500">No delivery events reported yet.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Event</TH>
                  <TH>Detail</TH>
                </TR>
              </THead>
              <tbody>
                {(events ?? []).map((e: any) => (
                  <TR key={e.id}>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{when(e.occurred_at)}</TD>
                    <TD className="text-sm text-gray-900">{EVENT_LABEL[e.event_type] ?? e.event_type}</TD>
                    <TD className="text-sm text-gray-600">{e.detail ?? '—'}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Surface>

        <Surface>
          <SectionTitle title="Message" />
          <div className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-800">{plainText(email.body)}</div>
        </Surface>
      </div>
    </DataWorkspace>
  );
}
