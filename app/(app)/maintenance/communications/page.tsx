import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { BulkCommsForm } from './_bulk-comms-form';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';

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
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Maintenance / Communications</div>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">Vendor Communications</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Send bulk email or SMS to vendors about work orders, status updates, and maintenance reminders. Messages are logged in the Communication Center.
          </p>
        </div>
      </div>

      {/* Compose Section */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Compose Bulk Message</h2>
        <BulkCommsForm
          workOrders={woRows}
          vendors={vendors ?? []}
          templates={templates ?? []}
          maintenanceTasks={maintenanceTasks ?? []}
          preSelectedWoId={sp.work_order_id ?? ''}
        />
      </div>

      {/* History Section */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Maintenance Communications History</h2>
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
                  <TD className="whitespace-nowrap text-sm">{formatDate(msg.created_at)}</TD>
                  <TD className="uppercase text-xs font-semibold text-gray-600">{msg.channel}</TD>
                  <TD>
                    <div className="text-sm capitalize text-gray-900">{String(msg.recipient_group ?? 'vendor').replaceAll('_', ' ')}</div>
                    <div className="text-xs text-gray-500">{msg.recipient_email ?? msg.recipient_phone ?? '-'}</div>
                  </TD>
                  <TD className="max-w-xl">
                    <div className="font-medium text-gray-900">{msg.subject ?? 'No subject'}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-gray-500">{msg.body}</div>
                  </TD>
                  <TD>
                    <span className={`rounded px-2 py-0.5 text-xs capitalize ${statusTone[msg.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {msg.status}
                    </span>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <h2 className="text-base font-semibold text-gray-900">No maintenance communications yet</h2>
            <p className="mt-1 text-sm text-gray-500">
              Bulk messages sent to vendors about work orders and maintenance tasks will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
