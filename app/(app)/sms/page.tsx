import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { SmsForm } from './_sms-form';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function SmsPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  // Get conversations
  const { data: conversations } = await db
    .from('sms_conversations')
    .select('*')
    .eq('portfolio_id', me.portfolio?.id)
    .order('last_message_at', { ascending: false })
    .limit(50);

  // Get owners for dropdown
  const { data: owners } = await db
    .from('owners')
    .select('id, full_name, phone, phone_numbers')
    .is('archived_at', null)
    .eq('portfolio_id', me.portfolio?.id)
    .order('full_name')
    .limit(200);

  // Get vendors for dropdown
  const { data: vendors } = await db
    .from('vendors')
    .select('id, name, phone_numbers')
    .eq('portfolio_id', me.portfolio?.id)
    .order('name')
    .limit(200);

  // Get templates
  const { data: templates } = await db
    .from('message_templates')
    .select('id, name, body')
    .eq('portfolio_id', me.portfolio?.id)
    .eq('channel', 'sms')
    .order('name');

  const convoRows = conversations ?? [];

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-6">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Communication / SMS</div>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">SMS Text Messages</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Send text messages to owners and vendors. Templates, history, and opt-in management available.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/sms/templates"><Button variant="secondary">Templates</Button></Link>
          <Link href="/sms/opt-ins"><Button variant="secondary">Opt-Ins</Button></Link>
        </div>
      </div>

      {/* Send SMS Form */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Send a Text Message</h2>
        <SmsForm owners={owners ?? []} vendors={vendors ?? []} templates={templates ?? []} />
      </div>

      {/* Conversations / History */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Recent Conversations</h2>
        {convoRows.length ? (
          <Table>
            <THead>
              <TR>
                <TH>Last activity</TH>
                <TH>Recipient</TH>
                <TH>Type</TH>
                <TH>Phone</TH>
                <TH>Last message</TH>
              </TR>
            </THead>
            <tbody>
              {convoRows.map((conv: any) => (
                <TR key={conv.id}>
                  <TD className="whitespace-nowrap text-sm">{formatDate(conv.last_message_at)}</TD>
                  <TD className="font-medium text-gray-900">{conv.with_name || 'Unknown'}</TD>
                  <TD className="text-sm capitalize text-gray-600">{conv.with_entity_type}</TD>
                  <TD className="font-mono text-xs text-gray-600">{conv.with_phone_number}</TD>
                  <TD className="max-w-md truncate text-sm text-gray-600">{conv.last_message_preview || '-'}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <h2 className="text-base font-semibold text-gray-900">No conversations yet</h2>
            <p className="mt-1 text-sm text-gray-500">Send your first SMS using the form above to start a conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
