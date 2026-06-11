import { MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { BulkCommsForm } from './_bulk-comms-form';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Badge, EmptyState, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function MaintenanceCommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ work_order_id?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  // Fetch work orders with vendors
  const { data: workOrders } = await db
    .from('work_orders')
    .select('id, number, title, status, priority, vendor_id, association_id, scheduled_date, vendors(name, emails, phone_numbers), associations(name)')
    .is('archived_at', null)
    .not('vendor_id', 'is', null)
    .not('status', 'in', '("completed","closed","cancelled")')
    .order('priority', { ascending: false })
    .order('scheduled_date', { ascending: true })
    .limit(200);

  // Fetch all vendors (for manual selection)
  const { data: vendors } = await db
    .from('vendors')
    .select('id, name, emails, phone_numbers, trade')
    .is('archived_at', null)
    .eq('portfolio_id', me.portfolio?.id)
    .order('name')
    .limit(200);

  // Fetch past maintenance communications (all recent messages)
  const { data: messages } = await db
    .from('communication_messages')
    .select('id, channel, status, recipient_group, recipient_email, recipient_phone, subject, body, created_at, sent_at')
    .eq('portfolio_id', me.portfolio?.id)
    .order('created_at', { ascending: false })
    .limit(100);

  // Fetch message templates for maintenance context
  const { data: templates } = await db
    .from('message_templates')
    .select('id, name, subject, body, channel')
    .eq('portfolio_id', me.portfolio?.id)
    .in('channel', ['email', 'sms', 'both'])
    .order('name');

  // Fetch maintenance tasks with vendors for reminder context
  const { data: maintenanceTasks } = await db
    .from('maintenance_tasks')
    .select('id, task_name, vendor_id, next_due_date, category, vendors(name, emails, phone_numbers)')
    .is('archived_at', null)
    .not('vendor_id', 'is', null)
    .order('next_due_date', { ascending: true })
    .limit(100);

  const messageRows = messages ?? [];
  const woRows = workOrders ?? [];

  return (
    <DataWorkspace
      title="Vendor Communications"
      description="Send bulk email or SMS to vendors about work orders, status updates, and maintenance reminders. Messages are logged in the Communication Center."
    >
      <div className="space-y-6">
        {/* Compose Section */}
        <Surface>
          <SectionTitle title="Compose bulk message" />
          <BulkCommsForm
            workOrders={woRows}
            vendors={vendors ?? []}
            templates={templates ?? []}
            maintenanceTasks={maintenanceTasks ?? []}
            preSelectedWoId={sp.work_order_id ?? ''}
          />
        </Surface>

        {/* History Section */}
        <div>
          <SectionTitle title="Maintenance communications history" />
          {messageRows.length ? (
            <Table>
              <THead>
                <TR>
                  <TH>Created</TH>
                  <TH>Channel</TH>
                  <TH>Recipients</TH>
                  <TH>Subject / Message</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <tbody>
                {messageRows.map((msg: any) => (
                  <TR key={msg.id}>
                    <TD className="whitespace-nowrap">{formatDate(msg.created_at)}</TD>
                    <TD className="text-xs font-semibold uppercase text-gray-600">{msg.channel}</TD>
                    <TD>
                      <div className="capitalize text-gray-900">{String(msg.recipient_group ?? 'vendor').replaceAll('_', ' ')}</div>
                      <div className="text-xs text-gray-500">{msg.recipient_email ?? msg.recipient_phone ?? '—'}</div>
                    </TD>
                    <TD className="max-w-xl">
                      <div className="font-medium text-gray-900">{msg.subject ?? 'No subject'}</div>
                      <div className="mt-1 line-clamp-2 text-gray-500">{msg.body}</div>
                    </TD>
                    <TD><Badge status={msg.status} /></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <EmptyState
                icon={MessageSquare}
                title="No maintenance communications yet"
                description="Bulk messages sent to vendors about work orders and maintenance tasks will appear here."
              />
            </div>
          )}
        </div>
      </div>
    </DataWorkspace>
  );
}
