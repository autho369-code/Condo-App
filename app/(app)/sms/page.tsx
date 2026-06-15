import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { SmsForm } from './_sms-form';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function SmsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
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

  // Get tenants for dropdown (data-only contacts — reachable by SMS/email)
  const { data: tenants } = await db
    .from('tenants')
    .select('id, first_name, last_name, phone')
    .eq('portfolio_id', me.portfolio?.id)
    .eq('status', 'active')
    .is('archived_at', null)
    .order('last_name')
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
    <DataWorkspace
      title="SMS Text Messages"
      description="Send text messages to owners, tenants, and vendors. Templates, history, and opt-in management available."
      actions={
        <>
          <Link href="/sms/templates"><Button variant="secondary">Templates</Button></Link>
          <Link href="/sms/opt-ins"><Button variant="secondary">Opt-Ins</Button></Link>
        </>
      }
    >
      <div className="space-y-6">
        {sp.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <span className="font-semibold">Could not send SMS:</span> {sp.error}
          </div>
        )}

        {/* Send SMS Form */}
        <Surface>
          <SectionTitle title="Send a text message" />
          <SmsForm owners={owners ?? []} vendors={vendors ?? []} tenants={tenants ?? []} templates={templates ?? []} />
        </Surface>

        {/* Conversations / History */}
        <div>
          <SectionTitle title="Recent conversations" />
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
                    <TD className="whitespace-nowrap">{formatDate(conv.last_message_at)}</TD>
                    <TD className="font-medium text-gray-900">{conv.with_name || 'Unknown'}</TD>
                    <TD className="capitalize text-gray-600">{conv.with_entity_type}</TD>
                    <TD className="font-mono text-xs text-gray-600">{conv.with_phone_number}</TD>
                    <TD className="max-w-md truncate text-gray-600">{conv.last_message_preview || '—'}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <EmptyState
                icon={MessageCircle}
                title="No conversations yet"
                description="Send your first SMS using the form above to start a conversation."
              />
            </div>
          )}
        </div>
      </div>
    </DataWorkspace>
  );
}
