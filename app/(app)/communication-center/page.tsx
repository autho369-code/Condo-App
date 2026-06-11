import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return '—';
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
    <DataWorkspace
      title="Communication Center"
      description="Central queue for event notices, vendor confirmations, SMS drafts, board reminders, and communication history."
      actions={
        <Link href="/send-email">
          <Button>Compose email</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <MetricStrip
          metrics={[
            { label: 'Total messages', value: rows.length },
            { label: 'Drafts awaiting approval', value: drafts },
            { label: 'Failed delivery', value: failed },
            { label: 'Sent', value: rows.filter((message: any) => message.status === 'sent').length },
          ]}
        />

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
                  <TD className="whitespace-nowrap">{formatDate(message.created_at)}</TD>
                  <TD className="text-xs font-semibold uppercase text-gray-600">{message.channel}</TD>
                  <TD>
                    <div className="capitalize text-gray-900">{String(message.recipient_group ?? '').replaceAll('_', ' ')}</div>
                    <div className="text-xs text-gray-500">{message.recipient_email ?? message.recipient_phone ?? 'Resolved at send time'}</div>
                  </TD>
                  <TD>{message.associations?.name ?? 'Portfolio-wide'}</TD>
                  <TD className="max-w-xl">
                    <div className="font-medium text-gray-900">{message.subject ?? 'No subject'}</div>
                    <div className="mt-1 line-clamp-2 text-gray-500">{message.body}</div>
                  </TD>
                  <TD><Badge status={message.status} /></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={MessageSquare}
              title="No communications yet"
              description="Calendar events and manual emails will create draft messages here."
              action={
                <Link href="/send-email">
                  <Button>Compose email</Button>
                </Link>
              }
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
