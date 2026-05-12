import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const statusTone: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700',
  queued: 'bg-blue-100 text-blue-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  canceled: 'bg-gray-100 text-gray-600',
};

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function CommunicationCenterPage() {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const { data: messages } = await db
    .from('communication_messages')
    .select('id, channel, status, recipient_group, recipient_email, recipient_phone, subject, body, created_at, sent_at, associations(name)')
    .order('created_at', { ascending: false })
    .limit(150);

  const rows = messages ?? [];
  const drafts = rows.filter((message: any) => message.status === 'draft').length;
  const failed = rows.filter((message: any) => message.status === 'failed').length;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-6">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Communication Center</div>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">Owner, tenant, board, and vendor communication</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Central queue for event notices, vendor confirmations, SMS drafts, board reminders, and communication history.
          </p>
        </div>
        <Link href="/send-email">
          <Button>Compose email</Button>
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Metric label="Total messages" value={rows.length} />
        <Metric label="Drafts awaiting approval" value={drafts} tone="text-amber-700" />
        <Metric label="Failed delivery" value={failed} tone="text-red-700" />
        <Metric label="Sent" value={rows.filter((message: any) => message.status === 'sent').length} tone="text-green-700" />
      </div>

      {rows.length ? (
        <Table>
          <THead>
            <TR>
              <TH>Created</TH>
              <TH>Channel</TH>
              <TH>Recipients</TH>
              <TH>Association</TH>
              <TH>Subject / Message</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((message: any) => (
              <TR key={message.id}>
                <TD className="whitespace-nowrap text-sm">{formatDate(message.created_at)}</TD>
                <TD className="uppercase text-xs font-semibold text-gray-600">{message.channel}</TD>
                <TD>
                  <div className="text-sm capitalize text-gray-900">{String(message.recipient_group ?? '').replaceAll('_', ' ')}</div>
                  <div className="text-xs text-gray-500">{message.recipient_email ?? message.recipient_phone ?? 'Resolved at send time'}</div>
                </TD>
                <TD className="text-sm text-gray-700">{message.associations?.name ?? 'Portfolio-wide'}</TD>
                <TD className="max-w-xl">
                  <div className="font-medium text-gray-900">{message.subject ?? 'No subject'}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-gray-500">{message.body}</div>
                </TD>
                <TD>
                  <span className={`rounded px-2 py-0.5 text-xs capitalize ${statusTone[message.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {message.status}
                  </span>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-gray-900">No communications yet</h2>
          <p className="mt-1 text-sm text-gray-500">Calendar events and manual emails will create draft messages here.</p>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone = 'text-gray-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
