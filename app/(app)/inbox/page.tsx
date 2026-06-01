import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

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
    <ModulePage title="Inbox" description="Two-way SMS with owners and vendors.">
      {rows && rows.length > 0 ? (
        <Table>
          <THead><TR><TH>When</TH><TH>Dir</TH><TH>From</TH><TH>To</TH><TH>Message</TH><TH>Status</TH></TR></THead>
          <tbody>
            {rows.map((m: any) => (
              <TR key={m.id}>
                <TD className="whitespace-nowrap text-sm">{date(m.sent_at)}</TD>
                <TD><span className={`rounded px-2 py-0.5 text-xs ${m.direction === 'inbound' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{m.direction}</span></TD>
                <TD className="font-mono text-xs">{m.from_number}</TD>
                <TD className="font-mono text-xs">{m.to_number}</TD>
                <TD className="max-w-md truncate">{m.body}</TD>
                <TD className="text-xs capitalize text-gray-500">{m.status}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">No SMS activity.</p>
      )}
    </ModulePage>
  );
}
