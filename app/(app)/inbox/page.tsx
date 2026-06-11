import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Badge, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';
import { Inbox } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('sms_messages')
    .select('id, direction, body, from_number, to_number, status, sent_at, read_at, sms_conversations(id)')
    .order('sent_at', { ascending: false })
    .limit(100);

  return (
    <DataWorkspace title="Inbox" description="Two-way SMS with owners and vendors.">
      {rows && rows.length > 0 ? (
        <Table>
          <THead><tr><TH>When</TH><TH>Direction</TH><TH>From</TH><TH>To</TH><TH>Message</TH><TH>Status</TH></tr></THead>
          <tbody>
            {rows.map((m: any) => (
              <TR key={m.id}>
                <TD className="whitespace-nowrap">{date(m.sent_at)}</TD>
                <TD><Badge tone={m.direction === 'inbound' ? 'open' : 'inactive'}>{m.direction}</Badge></TD>
                <TD className="font-mono text-xs">{m.from_number}</TD>
                <TD className="font-mono text-xs">{m.to_number}</TD>
                <TD className="max-w-md truncate">{m.body}</TD>
                <TD className="text-xs capitalize text-gray-500">{m.status}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <EmptyState
            icon={Inbox}
            title="No SMS activity"
            description="Inbound and outbound text messages will appear here."
          />
        </div>
      )}
    </DataWorkspace>
  );
}
